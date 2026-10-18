import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeToolJsx, formatToolResult } from '../tool-executor.js';
import { colorSchema, COLOR_HELPERS_JSX, WRITE_IDEMPOTENT_ANNOTATIONS, DESTRUCTIVE_ANNOTATIONS } from '../modify/shared.js';

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const documentSchema = z.object({ name: z.string().min(1), path: z.string().min(1).optional() });
const semanticSchema = z.object({
  role: z.string().min(1).max(120).optional(),
  evidence: z.string().max(2000).optional().describe('Observed source or explicit design assumption; do not present inferred site facts as surveyed data.'),
  confidence: z.number().min(0).max(1).optional(),
  evidence_kind: z.enum(['observed', 'inferred', 'proposed', 'supplied']).optional(),
  source_ref: z.string().trim().min(1).max(2000).optional(),
  data_ref: z.string().trim().min(1).max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one semantic field');

const styleSchema = z.object({
  fill: colorSchema,
  stroke: colorSchema,
  stroke_width: z.number().min(0).max(1000).optional().describe('Stroke weight in Illustrator points, never geometric width.'),
  opacity: z.number().min(0).max(100).optional().describe('Whole object opacity, not fill-only opacity.'),
  dashes: z.array(z.number().min(0).max(10000)).max(20).optional()
    .refine((value) => !value || value.length === 0 || value.some((part) => part > 0), 'A dash pattern must contain a positive length; [] means solid'),
  dash_offset: z.number().min(-100000).max(100000).optional(),
  cap: z.enum(['butt', 'round', 'projecting']).optional(),
  join: z.enum(['miter', 'round', 'bevel']).optional(),
  blending: z.enum(['normal', 'multiply', 'screen']).optional(),
  semantic: semanticSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one style or semantic change');

// Quoted RegExp sources keep the upstream ES3 ternary scanner from mistaking
// regex quantifiers for conditional expressions inside embedded JSX.
const jsonEscapesPattern = JSON.stringify(String.raw`\\["\\\/bfnrtu]`);
const jsonTokensPattern = JSON.stringify(String.raw`"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?`);
const jsonArraysPattern = JSON.stringify(String.raw`(?:^|:|,)(?:\s*\[)+`);

// These functions run inside Illustrator's ES3 ExtendScript engine. No geometry,
// group appearance, lock state, clipping mask, or linked image is ever modified.
const helpersJsx = `
function archDocument(doc) {
  var result = { name: doc.name, path: null };
  try { result.path = doc.fullName.fsName; } catch (e) {}
  return result;
}
function archPath(value) {
  var out = String(value || "").split("\\\\").join("/");
  if (/^[a-zA-Z]:/.test(out)) out = out.toLowerCase();
  return out;
}
function archCheckDocument(doc, expected) {
  var actual = archDocument(doc);
  if (expected && (expected.name !== actual.name || (expected.path && archPath(expected.path) !== archPath(actual.path)))) {
    throw new Error("Active document does not match expected_document; nothing was modified.");
  }
  return actual;
}
function archExistingUuid(item) {
  try { return extractUUIDFromNote(item.note || ""); } catch (e) { return ""; }
}
function archAllItems(doc) {
  var result = [];
  // Document.pageItems is flattened in Illustrator; recurse from layers instead.
  for (var li = 0; li < doc.layers.length; li++) {
    iterateAllItems(doc.layers[li], function(item) { result.push(item); });
  }
  return result;
}
function archReadSemantic(item) {
  var note = "";
  try { note = item.note || ""; } catch (e) {}
  var body = extractUUIDFromNote(note) ? note.substring(36) : note;
  var delimiter = body.indexOf("::ai-mcp:");
  if (delimiter >= 0) body = body.substring(0, delimiter);
  var result = {};
  // jsonParse in the upstream ES3 helper uses eval. Only parse a restricted JSON
  // grammar here: Illustrator notes can contain arbitrary user-authored text.
  function safeJson(text) {
    if (!text || text.length > 16000) return null;
    var checked = text.replace(new RegExp(${jsonEscapesPattern}, "g"), "@").replace(new RegExp(${jsonTokensPattern}, "g"), "]").replace(new RegExp(${jsonArraysPattern}, "g"), "");
    if (!/^[\\],:{}\\s]*$/.test(checked)) return null;
    try { return jsonParse(text); } catch (e) { return null; }
  }
  var parsed = safeJson(body);
  if (parsed && parsed.architectureMcp && typeof parsed.architectureMcp === "object") result = parsed.architectureMcp;
  var patch = getNoteMeta(note, "arch_semantic");
  if (patch) {
    try {
      var decoded = safeJson(decodeURIComponent(patch));
      if (decoded) {
        if (typeof decoded.role === "string") result.role = decoded.role;
        if (typeof decoded.evidence === "string") result.evidence = decoded.evidence;
        if (typeof decoded.confidence === "number") result.confidence = decoded.confidence;
        if (typeof decoded.evidence_kind === "string") result.evidence_kind = decoded.evidence_kind;
        if (typeof decoded.source_ref === "string") result.source_ref = decoded.source_ref;
        if (typeof decoded.data_ref === "string") result.data_ref = decoded.data_ref;
      }
    } catch (ePatch) {}
  }
  return result;
}
function archGuard(item) {
  if (item.typename !== "PathItem" && item.typename !== "TextFrame") return "Only explicit PathItem/TextFrame leaves can be styled; inspect group children and address their UUIDs.";
  var cursor = item, depth = 0;
  while (cursor && depth < 100) {
    var cursorType = cursor.typename;
    if (cursorType === "Document") return null;
    if (cursor.locked === true) return "Object or ancestor is locked.";
    if ((cursorType === "Layer" && cursor.visible === false) || (cursorType !== "Layer" && cursor.hidden === true)) return "Object or ancestor is hidden.";
    if (cursorType === "PathItem" && cursor.clipping === true) return "Clipping masks are protected.";
    if (cursorType === "PathItem" && cursor.guides === true) return "Guides are protected.";
    if (cursorType === "CompoundPathItem") return "Compound-path members share appearance and cannot be styled independently.";
    cursor = cursor.parent;
    depth++;
  }
  return "Could not verify the complete parent chain.";
}
function archEnum(value, kind) {
  if (kind === "cap") {
    if (value === StrokeCap.BUTTENDCAP) return "butt";
    if (value === StrokeCap.ROUNDENDCAP) return "round";
    if (value === StrokeCap.PROJECTINGENDCAP) return "projecting";
  }
  if (kind === "join") {
    if (value === StrokeJoin.MITERENDJOIN) return "miter";
    if (value === StrokeJoin.ROUNDENDJOIN) return "round";
    if (value === StrokeJoin.BEVELENDJOIN) return "bevel";
  }
  if (kind === "blend") {
    if (value === BlendModes.NORMAL) return "normal";
    if (value === BlendModes.MULTIPLY) return "multiply";
    if (value === BlendModes.SCREEN) return "screen";
  }
  return String(value);
}
function archArray(value) {
  var out = [];
  if (value && typeof value.length === "number") {
    for (var i = 0; i < value.length; i++) out.push(value[i]);
  } else if (value) {
    // Illustrator versions expose strokeDashes as either an array or a numeric-key object.
    for (var j = 0; j < 20 && typeof value[j] === "number"; j++) out.push(value[j]);
  }
  return out;
}
function archStyle(item) {
  var out = { opacity: item.opacity, blending: archEnum(item.blendingMode, "blend") };
  if (item.typename === "PathItem") {
    out.fill = readTargetFill(item);
    out.stroke = readTargetStroke(item).color;
    out.stroke_width = item.strokeWidth;
    out.dashes = archArray(item.strokeDashes);
    out.dash_offset = item.strokeDashOffset;
    out.cap = archEnum(item.strokeCap, "cap");
    out.join = archEnum(item.strokeJoin, "join");
  } else if (item.typename === "TextFrame") {
    out.fill = readTargetFill(item);
    out.stroke = readTargetStroke(item).color;
    out.stroke_width = item.textRange.characterAttributes.strokeWeight;
    out.character_count = item.characters.length;
    out.text_style_scope = "entire text frame; aggregate values can be mixed";
  }
  return out;
}
function archInspectItem(item, params) {
  var uuid = ensureUUID(item);
  var result = {
    uuid: uuid, uuid_persistent: archExistingUuid(item) === uuid,
    type: item.typename, name: item.name || "", layer: getParentLayerName(item),
    bounds_document_pt: archArray(item.geometricBounds),
    visible: isItemEffectivelyVisible(item), locked: isItemEffectivelyLocked(item),
    style: archStyle(item), semantic: archReadSemantic(item),
    editable: archGuard(item) === null, protected_reason: archGuard(item)
  };
  if (item.typename === "PathItem") {
    result.closed = item.closed;
    result.clipping = item.clipping === true;
    result.guide = item.guides === true;
    result.point_count = item.pathPoints.length;
    if (params.include_points) {
      result.points_document_pt = [];
      for (var pi = 0; pi < item.pathPoints.length && pi < params.max_points; pi++) {
        var point = item.pathPoints[pi];
        result.points_document_pt.push({ anchor: archArray(point.anchor), left: archArray(point.leftDirection), right: archArray(point.rightDirection) });
      }
      result.points_truncated = item.pathPoints.length > params.max_points;
    }
  } else if (item.typename === "TextFrame") {
    result.text = String(item.contents).substring(0, 2000);
    result.text_truncated = String(item.contents).length > 2000;
  } else if (item.typename === "PlacedItem" || item.typename === "RasterItem") {
    result.image = { pixel_contents_editable: false };
    try { result.image.link_path = item.file.fsName; } catch (eFile) {}
    try { result.image.embedded = item.embedded; } catch (eEmbedded) {}
    try { result.image.matrix = { a: item.matrix.mValueA, b: item.matrix.mValueB, c: item.matrix.mValueC, d: item.matrix.mValueD, tx: item.matrix.mValueTX, ty: item.matrix.mValueTY }; } catch (eMatrix) {}
    result.image.note = "A flattened PNG/JPG has no separately editable roads, buildings, labels, or linework; identify features visually and add vector overlays.";
  } else if (item.typename === "GroupItem" || item.typename === "CompoundPathItem") {
    var children = item.typename === "GroupItem" ? item.pageItems : item.pathItems;
    result.child_count = children.length;
    result.children = [];
    for (var ci = 0; ci < children.length && ci < 100; ci++) {
      result.children.push({ uuid: ensureUUID(children[ci]), type: children[ci].typename, name: children[ci].name || "", semantic: archReadSemantic(children[ci]) });
    }
    result.children_truncated = children.length > 100;
  }
  return result;
}
`;

const inspectJsx = `
var preflight = preflightChecks();
if (preflight) { writeResultFile(RESULT_PATH, preflight); }
else {
  try {
    var params = readParamsFile(PARAMS_PATH), doc = app.activeDocument;
    ${helpersJsx}
    var actualDocument = archCheckDocument(doc, params.expected_document);
    var all = archAllItems(doc), matches = [], missing = [], uuidCounts = {}, requested = {};
    var limit = params.limit || 100, offset = params.offset || 0;
    params.max_points = params.max_points || 100;
    if (params.uuids) for (var ui = 0; ui < params.uuids.length; ui++) requested[params.uuids[ui]] = true;
    for (var i = 0; i < all.length; i++) {
      var item = all[i], uid = archExistingUuid(item);
      if (uid) uuidCounts[uid] = (uuidCounts[uid] || 0) + 1;
      if (params.uuids && !requested[uid]) continue;
      if (params.layer_name && getParentLayerName(item) !== params.layer_name) continue;
      matches.push(item);
    }
    if (params.uuids) for (var mi = 0; mi < params.uuids.length; mi++) {
      if (!uuidCounts[params.uuids[mi]]) missing.push(params.uuids[mi]);
    }
    var elements = [];
    for (var ri = offset; ri < matches.length && elements.length < limit; ri++) {
      var inspected = archInspectItem(matches[ri], params);
      inspected.uuid_match_count = uuidCounts[inspected.uuid] || 1;
      if (inspected.uuid_match_count > 1) { inspected.editable = false; inspected.protected_reason = "Duplicate persistent UUID; resolve duplicate IDs before editing."; }
      elements.push(inspected);
    }
    writeResultFile(RESULT_PATH, { success: true, document: actualDocument, coordinate_system: "document", units: "pt", bounds_order: ["left", "top", "right", "bottom"], count: elements.length, matched_count: matches.length, offset: offset, has_more: offset + elements.length < matches.length, missing_uuids: missing, elements: elements });
  } catch (e) { writeResultFile(RESULT_PATH, { success: false, error: true, message: "arch_inspect_elements: " + e.message }); }
}
`;

const styleJsx = `
var preflight = preflightChecks();
if (preflight) { writeResultFile(RESULT_PATH, preflight); }
else {
  var archAttempted = [], archSnapshots = [], archTargets = [], archChanges = [], archDocumentInfo = null;
  try {
    var params = readParamsFile(PARAMS_PATH), doc = app.activeDocument;
    ${helpersJsx}
    ${COLOR_HELPERS_JSX}
    function archSnapshot(item, changes) {
      var snap = { properties: {}, characters: [], style: archStyle(item), semantic: archReadSemantic(item) };
      var p = snap.properties;
      if (typeof changes.opacity !== "undefined") p.opacity = item.opacity;
      if (typeof changes.blending !== "undefined") p.blendingMode = item.blendingMode;
      if (changes.semantic) p.note = item.note;
      if (item.typename === "PathItem") {
        if (changes.fill) { p.fillColor = item.fillColor; p.filled = item.filled; }
        if (changes.stroke) { p.strokeColor = item.strokeColor; p.stroked = item.stroked; }
        if (typeof changes.stroke_width !== "undefined") p.strokeWidth = item.strokeWidth;
        if (typeof changes.dashes !== "undefined") p.strokeDashes = archArray(item.strokeDashes);
        if (typeof changes.dash_offset !== "undefined") p.strokeDashOffset = item.strokeDashOffset;
        if (typeof changes.cap !== "undefined") p.strokeCap = item.strokeCap;
        if (typeof changes.join !== "undefined") p.strokeJoin = item.strokeJoin;
      } else if (changes.fill || changes.stroke || typeof changes.stroke_width !== "undefined") {
        if (item.characters.length === 0 || item.characters.length > 10000) throw new Error("Text paint requires 1..10000 characters for complete snapshot and verification.");
        for (var ci = 0; ci < item.characters.length; ci++) {
          var ca = item.characters[ci].characterAttributes, character = {};
          if (changes.fill) character.fillColor = ca.fillColor;
          if (changes.stroke) character.strokeColor = ca.strokeColor;
          if (typeof changes.stroke_width !== "undefined") character.strokeWeight = ca.strokeWeight;
          snap.characters.push(character);
        }
      }
      return snap;
    }
    function archRestore(item, snap) {
      var failures = [];
      for (var key in snap.properties) if (snap.properties.hasOwnProperty(key)) {
        try { item[key] = snap.properties[key]; } catch (eProperty) { failures.push(key + ": " + eProperty.message); }
      }
      for (var ci = 0; ci < snap.characters.length; ci++) {
        var ca = item.characters[ci].characterAttributes, character = snap.characters[ci];
        for (var ck in character) if (character.hasOwnProperty(ck)) {
          try { ca[ck] = character[ck]; } catch (eCharacter) { failures.push("character " + ci + " " + ck + ": " + eCharacter.message); }
        }
      }
      return failures;
    }
    function archSnapshotEqual(item, snap) {
      for (var key in snap.properties) if (snap.properties.hasOwnProperty(key)) {
        var actual = item[key], expected = snap.properties[key];
        if (key === "fillColor" || key === "strokeColor") {
          if (jsonStringify(colorToObject(actual)) !== jsonStringify(colorToObject(expected))) return false;
        } else if (key === "strokeDashes") {
          if (jsonStringify(archArray(actual)) !== jsonStringify(expected)) return false;
        } else if (String(actual) !== String(expected)) return false;
      }
      for (var ci = 0; ci < snap.characters.length; ci++) {
        var ca = item.characters[ci].characterAttributes, character = snap.characters[ci];
        for (var ck in character) if (character.hasOwnProperty(ck)) {
          if (ck === "strokeWeight") { if (ca[ck] !== character[ck]) return false; }
          else if (jsonStringify(colorToObject(ca[ck])) !== jsonStringify(colorToObject(character[ck]))) return false;
        }
      }
      return true;
    }
    function archApply(item, change) {
      if (typeof change.opacity !== "undefined") item.opacity = change.opacity;
      if (change.blending) item.blendingMode = { normal: BlendModes.NORMAL, multiply: BlendModes.MULTIPLY, screen: BlendModes.SCREEN }[change.blending];
      if (item.typename === "PathItem") {
        if (change.fill) applyOptionalFill(item, change.fill);
        if (change.stroke) applyStroke(item, { color: change.stroke }, item.stroked);
        if (typeof change.stroke_width !== "undefined") item.strokeWidth = change.stroke_width;
        if (typeof change.dashes !== "undefined") item.strokeDashes = change.dashes;
        if (typeof change.dash_offset !== "undefined") item.strokeDashOffset = change.dash_offset;
        if (change.cap) item.strokeCap = { butt: StrokeCap.BUTTENDCAP, round: StrokeCap.ROUNDENDCAP, projecting: StrokeCap.PROJECTINGENDCAP }[change.cap];
        if (change.join) item.strokeJoin = { miter: StrokeJoin.MITERENDJOIN, round: StrokeJoin.ROUNDENDJOIN, bevel: StrokeJoin.BEVELENDJOIN }[change.join];
      } else {
        var ca = item.textRange.characterAttributes;
        if (change.fill) ca.fillColor = createColor(change.fill);
        if (change.stroke) ca.strokeColor = createColor(change.stroke);
        if (typeof change.stroke_width !== "undefined") ca.strokeWeight = change.stroke_width;
      }
      if (change.semantic) {
        var current = archReadSemantic(item), merged = {};
        if (typeof current.role === "string") merged.role = current.role;
        if (typeof current.evidence === "string") merged.evidence = current.evidence;
        if (typeof current.confidence === "number") merged.confidence = current.confidence;
        if (typeof current.evidence_kind === "string") merged.evidence_kind = current.evidence_kind;
        if (typeof current.source_ref === "string") merged.source_ref = current.source_ref;
        if (typeof current.data_ref === "string") merged.data_ref = current.data_ref;
        for (var sk in change.semantic) if (change.semantic.hasOwnProperty(sk)) merged[sk] = change.semantic[sk];
        setNoteMeta(item, "arch_semantic", encodeURIComponent(jsonStringify(merged)));
      }
    }
    function archColorMatches(actual, expected, warnings) {
      if (actual.type !== expected.type) {
        if (actual.type === "none" || expected.type === "none") return false;
        if ((actual.type === "rgb" || actual.type === "cmyk") && (expected.type === "rgb" || expected.type === "cmyk")) {
          warnings.push("Requested color was converted to the document color space; compare the stored verified color visually.");
          return true;
        }
        return false;
      }
      var fields = [];
      if (expected.type === "rgb") fields = ["r", "g", "b"];
      else if (expected.type === "cmyk") fields = ["c", "m", "y", "k"];
      else if (expected.type === "gray") fields = ["value"];
      for (var i = 0; i < fields.length; i++) if (Math.abs(actual[fields[i]] - expected[fields[i]]) > 0.5) return false;
      return true;
    }
    function archVerify(item, change, warnings) {
      var actual = archStyle(item), keys = ["opacity", "stroke_width", "dash_offset", "cap", "join", "blending", "dashes"];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (typeof change[key] === "undefined") continue;
        if (typeof change[key] === "number") {
          if (typeof actual[key] !== "number" || Math.abs(actual[key] - change[key]) > 0.01) throw new Error("Readback mismatch for " + key);
        } else if (jsonStringify(actual[key]) !== jsonStringify(change[key])) throw new Error("Readback mismatch for " + key);
      }
      if (item.typename === "PathItem") {
        if (change.fill && !archColorMatches(actual.fill, change.fill, warnings)) throw new Error("Readback mismatch for fill");
        if (change.stroke && !archColorMatches(actual.stroke, change.stroke, warnings)) throw new Error("Readback mismatch for stroke");
      } else {
        for (var ci = 0; ci < item.characters.length; ci++) {
          var ca = item.characters[ci].characterAttributes;
          if (change.fill && !archColorMatches(colorToObject(ca.fillColor), change.fill, warnings)) throw new Error("Readback mismatch for character fill " + ci);
          if (change.stroke && !archColorMatches(colorToObject(ca.strokeColor), change.stroke, warnings)) throw new Error("Readback mismatch for character stroke " + ci);
          if (typeof change.stroke_width !== "undefined" && Math.abs(ca.strokeWeight - change.stroke_width) > 0.01) throw new Error("Readback mismatch for character stroke width " + ci);
        }
      }
      var semantic = archReadSemantic(item);
      if (change.semantic) for (var key in change.semantic) if (change.semantic.hasOwnProperty(key) && semantic[key] !== change.semantic[key]) throw new Error("Readback mismatch for semantic " + key);
      return { style: actual, semantic: semantic };
    }
    archDocumentInfo = archCheckDocument(doc, params.expected_document);
    if (!params.expected_document) throw new Error("expected_document is required.");
    var all = archAllItems(doc), lookup = {}, counts = {}, seen = {}, issues = [];
    for (var i = 0; i < all.length; i++) {
      var uuid = archExistingUuid(all[i]);
      if (uuid) { lookup[uuid] = all[i]; counts[uuid] = (counts[uuid] || 0) + 1; }
    }
    for (var ri = 0; ri < params.edits.length; ri++) {
      var edit = params.edits[ri], item = lookup[edit.uuid], reason = null;
      if (seen[edit.uuid]) reason = "UUID is repeated in the request.";
      else if (!item) reason = "UUID was not found.";
      else if (counts[edit.uuid] !== 1) reason = "UUID resolves to multiple objects.";
      else reason = archGuard(item);
      seen[edit.uuid] = true;
      if (!reason && item.typename === "TextFrame" && (typeof edit.style.dashes !== "undefined" || typeof edit.style.dash_offset !== "undefined" || edit.style.cap || edit.style.join)) reason = "Dash, cap and join controls only apply to PathItem leaves.";
      if (!reason) {
        try {
          archSnapshots.push(archSnapshot(item, edit.style));
          archTargets.push(item);
          archChanges.push(edit);
        } catch (eSnapshot) { reason = "Cannot take a complete rollback snapshot: " + eSnapshot.message; }
      }
      if (reason) issues.push({ uuid: edit.uuid, reason: reason });
    }
    if (issues.length) {
      writeResultFile(RESULT_PATH, { success: false, error: true, phase: "preflight", partial: false, changed: [], changed_count: 0, document: archDocumentInfo, issues: issues, message: "Batch rejected before any edits; resolve every issue before retrying." });
    } else if (params.dry_run !== false) {
      var planned = [];
      for (var pi = 0; pi < archChanges.length; pi++) planned.push({ uuid: archChanges[pi].uuid, type: archTargets[pi].typename, before: { style: archSnapshots[pi].style, semantic: archSnapshots[pi].semantic }, requested: archChanges[pi].style });
      writeResultFile(RESULT_PATH, { success: true, dry_run: true, document: archDocumentInfo, planned: planned, changed: [], changed_count: 0, message: "Preflight passed; no style or note was modified. Call with dry_run:false to apply this exact plan." });
    } else {
      var verified = [], changed = [], warnings = [];
      for (var ai = 0; ai < archTargets.length; ai++) {
        archAttempted.push(ai);
        archApply(archTargets[ai], archChanges[ai].style);
        var readback = archVerify(archTargets[ai], archChanges[ai].style, warnings);
        verified.push({ uuid: archChanges[ai].uuid, style: readback.style, semantic: readback.semantic });
        if (!archSnapshotEqual(archTargets[ai], archSnapshots[ai])) changed.push(archChanges[ai].uuid);
      }
      var uniqueWarnings = [], warningSeen = {};
      for (var wi = 0; wi < warnings.length; wi++) if (!warningSeen[warnings[wi]]) { warningSeen[warnings[wi]] = true; uniqueWarnings.push(warnings[wi]); }
      writeResultFile(RESULT_PATH, appendColorSpaceWarnings({ success: true, dry_run: false, partial: false, document: archDocumentInfo, changed: changed, changed_count: changed.length, verified: verified, warnings: uniqueWarnings }));
    }
  } catch (e) {
    var rollbackErrors = [], remaining = [], attempted = [];
    for (var back = archAttempted.length - 1; back >= 0; back--) {
      var index = archAttempted[back], uid = archChanges[index].uuid;
      attempted.push(uid);
      try {
        var failures = archRestore(archTargets[index], archSnapshots[index]);
        for (var fi = 0; fi < failures.length; fi++) rollbackErrors.push({ uuid: uid, message: failures[fi] });
        if (!archSnapshotEqual(archTargets[index], archSnapshots[index])) { remaining.push(uid); rollbackErrors.push({ uuid: uid, message: "Rollback readback differs from snapshot." }); }
      } catch (eRollback) { remaining.push(uid); rollbackErrors.push({ uuid: uid, message: eRollback.message }); }
    }
    writeResultFile(RESULT_PATH, { success: false, error: true, phase: archAttempted.length ? "apply" : "preflight", document: archDocumentInfo, message: "arch_style_elements: " + e.message, partial: remaining.length > 0, attempted: attempted, changed: remaining, changed_count: remaining.length, rollback_complete: remaining.length === 0, rollback_errors: rollbackErrors, retry_advice: remaining.length ? "Do not blindly retry. Inspect changed UUIDs and recover the document state first." : "No residual changes detected. Inspect the error before retrying." });
  }
}
`;

export function register(server: McpServer): void {
  server.registerTool('arch_inspect_elements', {
    title: 'Inspect Architecture Diagram Elements',
    description: 'Inspect bounded paths, text, placed/raster images and group children, including precise style, persistent UUID, protection state and architecture semantic notes. Returns document coordinates in points. This is an idempotent metadata write: missing UUIDs are persisted in object and inspected child notes, preserving existing note content. It does not change artwork appearance or recognize or edit individual features inside flattened PNG/JPG pixels.',
    inputSchema: {
      expected_document: documentSchema.optional(),
      uuids: z.array(uuidSchema).min(1).max(200).optional(),
      layer_name: z.string().min(1).optional().describe('Exact immediate parent-layer name, including items inside groups.'),
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
      include_points: z.boolean().default(false),
      max_points: z.number().int().min(1).max(500).default(100),
    },
    annotations: WRITE_IDEMPOTENT_ANNOTATIONS,
  }, async (params) => executeToolJsx(inspectJsx, params));

  server.registerTool('arch_style_elements', {
    title: 'Style Architecture Diagram Elements Precisely',
    description: 'Batch exact UUID-based edits to leaf paths/text: paint, stroke weight (pt), dashes, caps, joins, object opacity, blending and evidence notes. Dry run by default, without style or note writes. Requires expected document, rejects missing/duplicate UUIDs, groups, raster images, compound members, clipping masks, guides and locked/hidden ancestors before modifying anything. Reads back values and attempts verified rollback on caught script failure; inspect partial/changed before retrying. Native Illustrator or transport failures can bypass rollback: outcome_unknown requires inspecting the expected document and target_uuids before an apply retry. Text paint affects all characters while retaining other typography.',
    inputSchema: {
      expected_document: documentSchema,
      edits: z.array(z.object({ uuid: uuidSchema, style: styleSchema }).strict()).min(1).max(200),
      dry_run: z.boolean().default(true),
    },
    annotations: { ...DESTRUCTIVE_ANNOTATIONS, idempotentHint: true },
  }, async (params) => {
    try {
      return await executeToolJsx(styleJsx, params);
    } catch (error) {
      const recoveryContext = {
        expected_document: params.expected_document,
        target_uuids: params.edits.map((edit) => edit.uuid),
        dry_run: params.dry_run !== false,
      };
      // The runner has read Illustrator's result file for JsxToolError. Keep
      // its concrete preflight, readback and rollback evidence intact.
      if (error instanceof Error && error.name === 'JsxToolError' && 'result' in error
        && error.result && typeof error.result === 'object' && !Array.isArray(error.result)) {
        return formatToolResult({
          error: true, success: false, stage: 'illustrator',
          ...error.result, ...recoveryContext, outcome_unknown: false,
        });
      }
      // A timeout/disconnection does not prove that Illustrator stopped or
      // rolled back. Never manufacture changed/rollback counts in this case.
      return formatToolResult({
        error: true, success: false,
        message: error instanceof Error ? error.message : String(error),
        stage: 'transport', outcome_unknown: true,
        ...recoveryContext,
        changes_possible: !recoveryContext.dry_run,
        retry_advice: recoveryContext.dry_run
          ? 'The dry-run validation outcome is unknown, but this mode does not write styles or notes. Restore the connection, confirm the expected document and target UUIDs, then rerun preflight if needed. Do not proceed to apply based on this failed validation.'
          : 'Do not retry automatically. A native Illustrator or transport failure can bypass script rollback or leave the operation running. Restore the connection and confirm that the operation has finished, then inspect the expected document and every target_uuid. Compare style and semantic notes with the preflight plan and resolve any partial changes before retrying.',
      });
    }
  });
}
