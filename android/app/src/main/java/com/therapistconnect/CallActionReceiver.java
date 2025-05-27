// android/app/src/main/java/com/therapistconnect/CallActionReceiver.java
package com.therapistconnect;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.NotificationManager;
import android.util.Log;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "Received action: " + action);

        // Cancel the notification
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(9999);

        if ("ACCEPT_CALL".equals(action)) {
            // Handle call acceptance
            String userName = intent.getStringExtra("userName");
            String userId = intent.getStringExtra("userId");
            String roomId = intent.getStringExtra("roomId");
            String callId = intent.getStringExtra("callId");
            
            Log.d(TAG, "Accepting call from " + userName);
            
            // Launch the app and navigate to call screen
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("action", "ACCEPT_CALL");
            launchIntent.putExtra("userName", userName);
            launchIntent.putExtra("userId", userId);
            launchIntent.putExtra("roomId", roomId);
            launchIntent.putExtra("callId", callId);
            
            context.startActivity(launchIntent);
            
        } else if ("DECLINE_CALL".equals(action)) {
            // Handle call decline
            String userId = intent.getStringExtra("userId");
            String roomId = intent.getStringExtra("roomId");
            
            Log.d(TAG, "Declining call from " + userId);
            
            // You can send a broadcast to React Native to handle the decline
            Intent declineIntent = new Intent("CALL_DECLINED");
            declineIntent.putExtra("userId", userId);
            declineIntent.putExtra("roomId", roomId);
            context.sendBroadcast(declineIntent);
        }
    }
}