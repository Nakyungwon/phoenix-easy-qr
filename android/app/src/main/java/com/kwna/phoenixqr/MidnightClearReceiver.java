package com.kwna.phoenixqr;

import android.app.WallpaperManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// 자정 알람이 울리면 지난 QR이 들어간 잠금화면 배경을 지운다. 앱이 꺼져 있어도 시스템이 호출한다.
public class MidnightClearReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            WallpaperManager.getInstance(context).clear(WallpaperManager.FLAG_LOCK);
        } catch (Exception ignored) {
            // 다음에 앱을 열면 웹 쪽에서 지난 QR을 다시 정리한다.
        }
    }
}
