package space.bybloshq.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Safe Firebase initialization fallback if google-services.json is missing
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("space.bybloshq.app")
                        .setApiKey("AIzaSyDummyKeyForLocalDevPushPlaceholder")
                        .setProjectId("bybloshq-app")
                        .setGcmSenderId("123456789012")
                        .build();
                FirebaseApp.initializeApp(this, options);
                Log.i(TAG, "Initialized default FirebaseApp with fallback options");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to initialize fallback FirebaseApp", t);
        }

        // Register the custom native share plugin before the bridge starts.
        registerPlugin(SocialSharePlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Flush in-memory cookies to persistent storage when app goes to background
        CookieManager.getInstance().flush();
    }
}

