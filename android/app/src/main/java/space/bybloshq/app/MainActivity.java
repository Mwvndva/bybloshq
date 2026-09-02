package space.bybloshq.app;

import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the custom native share plugin before the bridge starts.
        registerPlugin(SocialSharePlugin.class);
        super.onCreate(savedInstanceState);

        // Block native Android hardware screenshots, screen recording, and app-switcher previews
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );

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
