package com.kwna.phoenixqr;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.WallpaperManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 잠금화면 배경만 바꾼다(홈 화면 배경은 그대로). 이미지는 웹 쪽 캔버스에서 만들어 PNG data URL로 넘겨받는다.
@CapacitorPlugin(name = "LockWallpaper")
public class LockWallpaperPlugin extends Plugin {

    // 앱 바로가기(res/xml/shortcuts.xml)의 intent action과 웹 화면에 넘기는 이름.
    private static final String ACTION_PREFIX = "com.kwna.phoenixqr.shortcut.";
    private static String pendingShortcut;

    // 바로가기로 열렸으면 처리할 동작을 기억해 둔다. 최근 앱 목록에서 다시 열면 처음 intent가 다시 오므로 무시한다.
    static boolean offerShortcut(Intent intent) {
        if (intent == null || intent.getAction() == null || !intent.getAction().startsWith(ACTION_PREFIX)) return false;
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return false;
        pendingShortcut = intent.getAction().substring(ACTION_PREFIX.length());
        return true;
    }

    // 바로가기 작업을 마친 뒤 앱을 뒤로 보낸다(종료가 아님). 루틴 실행 전에 보던 화면이 다시 보인다.
    @PluginMethod
    public void moveToBack(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    // 웹 화면이 시작 처리를 마친 뒤 부른다. 한 번 넘기면 비운다.
    @PluginMethod
    public void takeShortcut(PluginCall call) {
        JSObject result = new JSObject();
        if (pendingShortcut != null) result.put("action", pendingShortcut);
        pendingShortcut = null;
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        if (dataUrl == null) {
            call.reject("dataUrl이 없어요");
            return;
        }
        try {
            byte[] png = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(png, 0, png.length);
            WallpaperManager.getInstance(getContext()).setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
            Long clearAt = call.getLong("clearAt");
            if (clearAt != null) scheduleClear(clearAt);
            call.resolve();
        } catch (Exception e) {
            call.reject("잠금화면 배경 설정 실패: " + e.getMessage());
        }
    }

    // 잠금화면 전용 배경을 지우면 시스템이 홈 화면 배경을 잠금화면에도 쓴다.
    @PluginMethod
    public void clear(PluginCall call) {
        try {
            WallpaperManager.getInstance(getContext()).clear(WallpaperManager.FLAG_LOCK);
            alarmManager().cancel(clearIntent());
            call.resolve();
        } catch (Exception e) {
            call.reject("잠금화면 배경 복원 실패: " + e.getMessage());
        }
    }

    // 정확한 알람 권한 없이 쓸 수 있는 방식이라 절전 상태에서는 몇 분 늦게 울릴 수 있다. 재부팅하면 알람이 사라지고, 그때는 앱을 열 때 정리된다.
    private void scheduleClear(long atMillis) {
        alarmManager().setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, clearIntent());
    }

    private AlarmManager alarmManager() {
        return (AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
    }

    private PendingIntent clearIntent() {
        Intent intent = new Intent(getContext(), MidnightClearReceiver.class);
        return PendingIntent.getBroadcast(getContext(), 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
