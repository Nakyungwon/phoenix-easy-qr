package com.kwna.phoenixqr;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LockWallpaperPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
