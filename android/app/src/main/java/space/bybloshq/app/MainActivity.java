package space.bybloshq.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the custom native share plugin before the bridge starts.
        registerPlugin(SocialSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
