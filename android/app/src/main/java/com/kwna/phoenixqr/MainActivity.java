package com.kwna.phoenixqr;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LockWallpaperPlugin.class);
        super.onCreate(savedInstanceState);
        // 화면 회전 등으로 다시 만들어질 때는 같은 바로가기를 또 실행하지 않는다.
        if (savedInstanceState == null) LockWallpaperPlugin.offerShortcut(getIntent());
    }

    // 앱이 이미 떠 있을 때 바로가기로 열리면 여기로 온다(singleTask). 웹 화면에 알려서 바로 처리하게 한다.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (LockWallpaperPlugin.offerShortcut(intent) && bridge != null) bridge.triggerWindowJSEvent("shortcut");
    }
}
