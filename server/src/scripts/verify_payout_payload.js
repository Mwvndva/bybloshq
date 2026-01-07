import payoutService from '../services/payout.service.js';

// Mock the internal client and logger to capture the payload
const mockPost = async (url, payload, config) => {
    console.log('\n--- GENERATED PAYLOAD ---');
    console.log(JSON.stringify(payload, null, 2));
    console.log('--- END PAYLOAD ---\n');
    return { status: 200, data: { success: true, message: "Mock success" } };
};

payoutService.client.post = mockPost;
payoutService.getCallbackUrl = async () => "https://bybloshq.space/api/callbacks/payd"; // Mock callback for consistency

// Use dummy env vars for the test if not present (although service constructor loaded them already)
payoutService.username = "test_user";
payoutService.password = "test_password";
payoutService.networkCode = "test_net_code";
payoutService.channelId = "test_channel_id";

async function runTest() {
    console.log("Running Payout Payload Verification...");

    try {
        await payoutService.initiateMobilePayout({
            amount: 100,
            phone_number: "254712345678",
            narration: "Test Withdrawal",
            account_name: "Test Seller",
            reference: "SHOULD_BE_IGNORED" // Testing that this is stripped if not in logic
        });
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
