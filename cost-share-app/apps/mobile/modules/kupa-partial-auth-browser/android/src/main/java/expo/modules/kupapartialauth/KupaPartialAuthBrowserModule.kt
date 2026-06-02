package expo.modules.kupapartialauth

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.customtabs.CustomTabsServiceConnection
import androidx.core.net.toUri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

private const val DUMMY_URL = "https://expo.dev"

class KupaPartialAuthBrowserModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KupaPartialAuthBrowser")

    AsyncFunction("openPartialCustomTabAsync") { url: String, initialHeightPx: Int ->
      val activity = appContext.throwingActivity
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val packageManager = activity.packageManager ?: throw Exceptions.ReactContextLost()

      val browserPackage = resolvePreferredBrowserPackage(packageManager)
        ?: throw BrowserNotAvailableException()

      suspendCancellableCoroutine { continuation ->
        val connection = object : CustomTabsServiceConnection() {
          override fun onCustomTabsServiceConnected(name: ComponentName, client: CustomTabsClient) {
            try {
              launchPartialTab(activity, browserPackage, client, url, initialHeightPx)
              if (continuation.isActive) {
                continuation.resume(mapOf("type" to "opened"))
              }
            } catch (e: Exception) {
              if (continuation.isActive) {
                continuation.resumeWithException(e)
              }
            } finally {
              try {
                context.unbindService(this)
              } catch (_: Exception) {
              }
            }
          }

          override fun onServiceDisconnected(name: ComponentName?) {
          }
        }

        val bound = CustomTabsClient.bindCustomTabsService(context, browserPackage, connection)
        if (!bound) {
          try {
            launchPartialTab(activity, browserPackage, null, url, initialHeightPx)
            if (continuation.isActive) {
              continuation.resume(mapOf("type" to "opened"))
            }
          } catch (e: Exception) {
            if (continuation.isActive) {
              continuation.resumeWithException(e)
            }
          }
        }

        continuation.invokeOnCancellation {
          try {
            context.unbindService(connection)
          } catch (_: Exception) {
          }
        }
      }
    }
  }

  private fun launchPartialTab(
    activity: android.app.Activity,
    browserPackage: String,
    client: CustomTabsClient?,
    url: String,
    initialHeightPx: Int,
  ) {
    val session = client?.newSession(null)
    val builder = if (session != null) {
      CustomTabsIntent.Builder(session)
    } else {
      CustomTabsIntent.Builder()
    }

    builder.setShowTitle(true)
      .setToolbarCornerRadiusDp(28)
      .setInitialActivityHeightPx(
        initialHeightPx,
        CustomTabsIntent.ACTIVITY_HEIGHT_FIXED,
      )

    val tabsIntent = builder.build().apply {
      intent.setPackage(browserPackage)
    }

    tabsIntent.launchUrl(activity, url.toUri())
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
