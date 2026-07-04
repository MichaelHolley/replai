// electron-builder afterPack hook.
//
// v1 ships unsigned (no Developer ID) for a developer, build-locally audience.
// But Apple Silicon requires a *valid* signature to launch, and macOS keys the
// Screen Recording (TCC) grant off a stable bundle identity. electron-builder
// skips signing when `identity` is null, leaving only the linker's ad-hoc sig on
// the Electron binary (Info.plist unbound, resources unsealed). We ad-hoc sign
// the whole bundle so it launches and the permission grant sticks to com.fipsi.app.
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = join(context.appOutDir, appName)
  execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
  console.log(`  • ad-hoc signed ${appName}`)
}
