package space.bybloshq.app;

import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
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
            // Make the WebView background follow the OS light/dark mode, matching
            // the already night-qualified splash/window/status-bar. Without this,
            // the Capacitor config's static light backgroundColor (#F5F4F0) shows
            // for a frame on a dark cold launch, flashing before the web content
            // paints its resolved theme. byblos_launch_background is #F5F4F0 in
            // values/ and #000000 in values-night/.
            webView.setBackgroundColor(ContextCompat.getColor(this, R.color.byblos_launch_background));
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
