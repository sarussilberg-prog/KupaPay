package expo.modules.kupapartialauth

import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val DUMMY_URL = "https://expo.dev"

class KupaPartialAuthBrowserModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KupaPartialAuthBrowser")

    AsyncFunction("openPartialCustomTabAsync") { url: String, initialHeightPx: Int ->
      val activity = appContext.throwingActivity
      val packageManager = activity.packageManager ?: throw Exceptions.ReactContextLost()

      val browserPackage = resolvePreferredBrowserPackage(packageManager)
        ?: throw BrowserNotAvailableException()

      val builder = CustomTabsIntent.Builder()
        .setShowTitle(true)
        .setToolbarCornerRadiusDp(28)

      builder.setInitialActivityHeightPx(
        initialHeightPx,
        CustomTabsIntent.ACTIVITY_HEIGHT_FIXED,
      )

      val tabsIntent = builder.build().apply {
        intent.data = url.toUri()
        intent.setPackage(browserPackage)
        // Stay in the same task so the app remains visible behind the bottom sheet.
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY)
      }

      tabsIntent.launchUrl(activity, url.toUri())

      mapOf("type" to "opened")
    }
  }

  private fun resolvePreferredBrowserPackage(packageManager: PackageManager): String? {
    val dummyIntent = CustomTabsIntent.Builder().build().apply {
      intent.data = DUMMY_URL.toUri()
    }
    val packages = packageManager.queryIntentActivities(dummyIntent.intent, 0)
      .mapNotNull { info: ResolveInfo -> info.activityInfo?.packageName }
      .distinct()

    if (packages.isEmpty()) return null

    return CustomTabsClient.getPackageName(appContext.throwingActivity, packages, true)
      ?: packages.firstOrNull()
  }
}

class BrowserNotAvailableException : Exception("No browser supports Chrome Custom Tabs on this device")
