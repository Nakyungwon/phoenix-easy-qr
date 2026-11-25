package com.kwna.phoenixqr;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.WallpaperManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// 잠금화면 배경만 바꾼다(홈 화면 배경은 그대로). 이미지는 웹 쪽 캔버스에서 만들어 PNG data URL로 넘겨받는다.
@CapacitorPlugin(name = "LockWallpaper")
public class LockWallpaperPlugin extends Plugin {

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
