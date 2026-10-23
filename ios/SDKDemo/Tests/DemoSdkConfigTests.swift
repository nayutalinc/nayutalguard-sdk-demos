import XCTest
import NayutalSDK
@testable import SDKDemo

/// The configuration this demo hands the SDK, read back from the function the app itself calls.
///
/// Not asserted here: the DoH endpoint against the SDK's own built-in value, which the SDK keeps internal; the UDP pair
/// is compared with the SDK's public `DNSConstants.PublicDNS.udpBaseline`.
final class DemoSdkConfigTests: XCTestCase {

    private let config = DemoSdkConfig.make(baseUrl: "https://api.example.jp/", apiKey: "test-key")

    func testTheDemoNeverTurnsTheCertificateCheckOff() {
        // The certificate check reports SKIPPED on every scan when it is off; an integrator copying this demo must not
        // inherit that. Removing this assertion is deliberate (the source guard, scripts/check-certificate-check.mjs,
        // is its CI twin).
        XCTAssertTrue(config.certificateCheck, "the demo configuration reads certificateCheck true")
    }

    func testTheHeaderProviderReturnsTheDemosFixedHeader() throws {
        let provider = try XCTUnwrap(config.requestHeaders, "the demo configuration sets a request-header provider")
        XCTAssertEqual(try provider(), ["X-Demo-Client": "nayutal-sdk-demo"])
    }

    func testTheDemoNamesTheBuiltInPair_andTheSdkAcceptsIt() throws {
        let baseline = try XCTUnwrap(config.dnsBaseline, "the demo shows the dnsBaseline field")
        XCTAssertEqual(baseline.udpServers, DNSConstants.PublicDNS.udpBaseline)
        XCTAssertEqual(baseline.dohEndpoint, "https://1.1.1.1/dns-query")
        // make(config:) refuses a baseline that breaks the rule (and a blank key) before it builds anything.
        XCTAssertNoThrow(try NayutalScanner.make(config: config))
    }

    func testTheEndpointAndKeyAreTheOnesTheAppPassesIn() {
        XCTAssertEqual(config.baseUrl, "https://api.example.jp/")
        XCTAssertEqual(config.apiKey, "test-key")
    }
}
