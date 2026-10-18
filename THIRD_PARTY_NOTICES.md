# Third-party dependency inventory

This inventory records the **direct dependencies** used for the source build of
`0.1.0-alpha.2`. Versions come from `package-lock.json`; declared licenses were
checked against the installed package metadata and the named license files.
This is not a complete third-party license compilation, and the project's root
MIT license does not replace any third-party terms.

| Direct dependency | Locked version | Declared license | Role | Package license / notice files |
| --- | --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | `1.32.1` | MIT | MCP server/client protocol and transports | `LICENSE` |
| `p-limit` | `7.3.1` | MIT | Concurrent operation scheduling | `license` |
| `sharp` | `0.35.5` | Apache-2.0 | Raster image processing | `LICENSE` |
| `zod` | `4.3.6` | MIT | Tool schemas and input validation | `LICENSE` |
| `@types/node` | `26.2.0` | MIT | Development: Node.js type declarations | `LICENSE` |
| `tsx` | `4.23.11` | MIT | Development: TypeScript script execution | `LICENSE` |
| `typescript` | `7.0.2` | Apache-2.0 | Development: TypeScript compilation | `LICENSE`, `NOTICE.txt` |
| `vitest` | `4.1.11` | MIT | Development: automated tests | `LICENSE.md` |
| `esbuild` | `0.28.2` | MIT | Development: CommonJS bundle generation | `LICENSE.md` |

After `npm ci`, these files can be read under `node_modules/<package-name>/`.
The table is a record of the locked source build, not a promise that a later
tarball installation will resolve exactly the same versions under semver ranges.
Recheck the inventory when dependencies or the lockfile change.

Each build also creates `dist/THIRD-PARTY-NOTICES.txt` from the actual esbuild
input graph for `dist/bundle.cjs`. It includes the package identity, declared
license, and full available license/notice texts for every detected bundled
third-party package, including transitive packages. Packages missing those texts
cause the build to fail for review. This generated notice travels with the
runtime tarball; it does not claim to cover dependencies that are not bundled.

`sharp` is external to the bundle. Its npm package, native/platform packages,
libvips and other transitive components retain their own licenses and notices.
Inspect the resolved `package-lock.json` / installed dependency tree and each
package's license and notice files when redistributing those components. ESM
runtime dependencies are installed separately by npm and likewise retain their
own files. Native binaries and development dependencies are not embedded in this
project's runtime tarball.

The upstream Illustrator server attribution is recorded in [UPSTREAM.md](UPSTREAM.md)
and the original [LICENSE](LICENSE). Research references, fonts and Adobe
products are separate from the npm dependency licenses; see
[ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) and [DISCLAIMER.md](DISCLAIMER.md).
