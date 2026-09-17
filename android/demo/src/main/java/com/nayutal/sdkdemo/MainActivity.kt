package com.nayutal.sdkdemo

import android.app.Activity
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.nayutal.sdk.DeviceInfo
import com.nayutal.sdk.NayutalScanner
import com.nayutal.sdk.NayutalSdkConfig
import com.nayutal.sdk.api.FindingStatus
import com.nayutal.sdk.api.ScanEvent
import com.nayutal.sdk.api.SdkScanResult
import com.nayutal.sdk.dns.ScanEnvironment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Minimal HOST app for the Nayutal SDK — the integration story:
 * a dependency, a config with endpoint + key, one call per scan. The SDK
 * fetches its own data feeds (spec 6.2); this host implements NOTHING but
 * gathering device facts and rendering results.
 */
class MainActivity : Activity() {

    private val uiScope = CoroutineScope(Dispatchers.Main)
    private lateinit var output: TextView
    private lateinit var scanButton: Button

    // The ENTIRE integration surface: endpoint + this integration's key.
    // Key injected at build time (-PNAYUTAL_API_KEY), never in source.
    private val scanner by lazy {
        NayutalScanner.create(
            applicationContext,
            NayutalSdkConfig(
                baseUrl = BuildConfig.BASE_URL,
                apiKey = BuildConfig.NAYUTAL_API_KEY
            )
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        scanButton = Button(this).apply {
            text = "Run Scan"
            setOnClickListener { runScan() }
        }
        output = TextView(this).apply {
            text = "Press Run Scan.\n\nThis host supplies NOTHING but device facts — " +
                "the SDK fetches its own feeds from the Nayutal backend (spec 6.2)."
            setPadding(32, 32, 32, 32)
            textSize = 14f
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            // Android 15+ lays a targetSdk-35 app out edge-to-edge: without this
            // the button sits under the status bar and cannot be tapped.
            fitsSystemWindows = true
            addView(scanButton, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(ScrollView(this@MainActivity).apply { addView(output) },
                LinearLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        })
    }

    private fun runScan() {
        scanButton.isEnabled = false
        val progress = StringBuilder()
        output.text = "Scanning…"
        uiScope.launch {
            try {
                // The streaming API: findings render the moment each
                // mechanism completes — no waiting for the slowest.
                scanner.runScanStreaming(gatherEnvironment(), gatherDeviceInfo())
                    .collect { event ->
                        when (event) {
                            is ScanEvent.ScanStarted ->
                                progress.appendLine("scan ${event.scanId.take(8)} started…")
                            is ScanEvent.ContextClassified ->
                                progress.appendLine("network: ${event.networkContext.type} (multiplier ${event.networkContext.riskMultiplier})")
                            is ScanEvent.FindingReady ->
                                progress.appendLine("${event.finding.mechanism} done: raw=${event.finding.rawSeverity} adjusted=${event.finding.adjustedSeverity} [${event.finding.status}]")
                            is ScanEvent.ScanCompleted ->
                                progress.appendLine("\n${render(event.result)}")
                        }
                        output.text = progress.toString()
                    }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                output.text = "Scan failed: ${e.javaClass.simpleName}: ${e.message}"
            } finally {
                scanButton.isEnabled = true
            }
        }
    }

    // ---- Host duty: device facts the SDK is not allowed to read itself ------

    private fun gatherEnvironment(): ScanEnvironment {
        val batteryManager = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val caps = cm?.activeNetwork?.let { cm.getNetworkCapabilities(it) }
        return ScanEnvironment(
            batteryLevelPercent = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 100,
            isCharging = batteryManager?.isCharging ?: false,
            networkType = when {
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "WIFI"
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "CELLULAR"
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true -> "VPN"
                else -> "Unknown"
            },
            systemDnsServerIps = cm?.activeNetwork
                ?.let { cm.getLinkProperties(it) }?.dnsServers?.mapNotNull { it.hostAddress }
                ?: emptyList()
        )
    }

    private fun gatherDeviceInfo() = DeviceInfo(
        deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "demo-device",
        appVersion = "demo-0.2",
        osVersion = "Android ${android.os.Build.VERSION.RELEASE}",
        locale = resources.configuration.locales[0].toLanguageTag(),
        scanTrigger = "manual"
    )

    // ---- Host duty: render the structured result as user-facing text --------

    private fun render(r: SdkScanResult): String = buildString {
        appendLine("schema ${r.schemaVersion} · scan ${r.scanId.take(8)} · ${r.durationMs} ms")
        appendLine("OVERALL raw=${r.overall.rawSeverity} adjusted=${r.overall.adjustedSeverity}")
        if (r.incompleteChecks.isNotEmpty()) {
            appendLine("did not measure: ${r.incompleteChecks.joinToString()}")
        }
        appendLine()
        appendLine("-- network --")
        appendLine("${r.networkContext.type}  ssid=${r.networkContext.ssid ?: "n/a"}")
        appendLine("portal=${r.networkContext.captivePortal} safeProxy=${r.networkContext.knownSafeProxy} multiplier=${r.networkContext.riskMultiplier}")
        for (f in r.findings) {
            appendLine()
            appendLine("-- ${f.mechanism} --")
            when (f.status) {
                FindingStatus.MEASURED -> {
                    append("raw=${f.rawSeverity}")
                    f.rawScore?.let { append(" (score $it)") }
                    appendLine("  adjusted=${f.adjustedSeverity}")
                    for (t in f.threats) {
                        appendLine("  * ${t.category} ${t.severity}${t.subject?.let { " [$it]" } ?: ""}")
                        t.codes.take(3).forEach { appendLine("      $it") }
                    }
                    if (f.threats.isEmpty()) appendLine("  no threats")
                }
                else -> appendLine("${f.status}: ${f.statusReason}")
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        uiScope.cancel()
    }
}
