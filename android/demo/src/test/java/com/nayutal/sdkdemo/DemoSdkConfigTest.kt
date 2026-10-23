package com.nayutal.sdkdemo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The configuration this demo hands the SDK, read back from the function the app itself calls.
 *
 * Not asserted here: that the SDK accepts the DNS baseline. `NayutalScanner.create` needs an Android Context, and the
 * SDK's own copy of its built-in values is internal; the app shows a refused baseline as "SDK init failed" at startup.
 */
class DemoSdkConfigTest {

    private val config = demoSdkConfig(baseUrl = "https://api.example.jp/", apiKey = "test-key")

    @Test fun `the demo never turns the certificate check off`() {
        // The certificate check reports SKIPPED on every scan when it is off; an integrator copying this demo must not
        // inherit that. Removing this assertion is deliberate (the source guard, scripts/check-certificate-check.mjs,
        // is its CI twin).
        assertTrue("the demo configuration reads certificateCheck true", config.certificateCheck)
    }

    @Test fun `the header provider returns the demo's fixed header`() {
        val provider = config.requestHeaders
        assertNotNull("the demo configuration sets a request-header provider", provider)
        assertEquals(mapOf("X-Demo-Client" to "nayutal-sdk-demo"), provider!!())
    }

    @Test fun `the demo names a DNS baseline of two servers and an endpoint`() {
        val baseline = config.dnsBaseline
        assertNotNull("the demo shows the dnsBaseline field", baseline)
        assertEquals(listOf("8.8.8.8", "1.1.1.1"), baseline!!.udpServers)
        assertEquals("https://1.1.1.1/dns-query", baseline.dohEndpoint)
    }

    @Test fun `the endpoint and key are the ones the app passes in`() {
        assertEquals("https://api.example.jp/", config.baseUrl)
        assertEquals("test-key", config.apiKey)
    }
}
