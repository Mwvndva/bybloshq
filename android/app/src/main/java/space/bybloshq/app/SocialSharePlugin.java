package space.bybloshq.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Native sharing for the Byblos membership card.
 *
 * Instagram Stories: uses the documented com.instagram.share.ADD_TO_STORY intent
 * to drop the card straight into the Story composer (requires the Facebook App
 * ID as source_application). WhatsApp/other: a plain ACTION_SEND chooser, because
 * WhatsApp exposes no API to post to Status — the user picks WhatsApp then "My status".
 */
@CapacitorPlugin(name = "SocialShare")
public class SocialSharePlugin extends Plugin {

    // Public Facebook App ID for space.bybloshq.app — safe to ship in the client.
    private static final String FACEBOOK_APP_ID = "1516252869634911";
    private static final String IG_PACKAGE = "com.instagram.android";

    private Uri writePng(String base64) throws Exception {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        File file = new File(dir, "byblos-card.png");
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(bytes);
            fos.flush();
        }
        String authority = getContext().getPackageName() + ".fileprovider";
        return FileProvider.getUriForFile(getContext(), authority, file);
    }

    @PluginMethod
    public void shareToInstagramStory(PluginCall call) {
        String base64 = call.getString("pngBase64");
        if (base64 == null) {
            call.reject("Missing pngBase64");
            return;
        }
        try {
            Uri uri = writePng(base64);
            Activity activity = getActivity();

            Intent intent = new Intent("com.instagram.share.ADD_TO_STORY");
            intent.setDataAndType(uri, "image/png");
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra("source_application", FACEBOOK_APP_ID);
            intent.setPackage(IG_PACKAGE);

            activity.grantUriPermission(IG_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

            if (activity.getPackageManager().resolveActivity(intent, 0) == null) {
                call.reject("Instagram is not installed");
                return;
            }

            activity.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("shared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open Instagram Stories", e);
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String base64 = call.getString("pngBase64");
        String caption = call.getString("caption", "");
        if (base64 == null) {
            call.reject("Missing pngBase64");
            return;
        }
        try {
            Uri uri = writePng(base64);

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            if (caption != null && !caption.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, caption);
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, "Share your Byblos card");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("shared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to share image", e);
        }
    }
}
