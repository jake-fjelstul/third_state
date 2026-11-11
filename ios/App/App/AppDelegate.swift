import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Hand the iMessage app its sign-in whenever the web layer changes it.
        NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: nil, queue: .main) { _ in
            ExtensionSessionBridge.sync()
        }
        ExtensionSessionBridge.sync()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        ExtensionSessionBridge.sync()
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        ExtensionSessionBridge.sync()
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error)
    }

    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        completionHandler(.newData)
    }

}

/// Copies the iMessage extension's own session (written by
/// src/lib/extensionSession.js through @capacitor/preferences) into the App
/// Group both targets can read. Once there, the extension owns and refreshes
/// it; the app only replaces it when a different user signs in, and removes it
/// on sign-out. Kept in this file so the App target needs no new files.
enum ExtensionSessionBridge {
    static let appGroup = "group.com.thirdspace.social"
    static let sourceKey = "CapacitorStorage.ts.ext.session"
    static let groupKey = "session"
    static let statusKey = "CapacitorStorage.ts.ext.status"
    private static let copiedKey = "ts.ext.session.copied"

    static func sync() {
        guard let group = UserDefaults(suiteName: appGroup) else { return }
        let local = UserDefaults.standard
        // Why the last sign-in attempt failed, for the extension's banner.
        if let status = local.string(forKey: statusKey) {
            if group.string(forKey: "status") != status { group.set(status, forKey: "status") }
        } else if group.object(forKey: "status") != nil {
            group.removeObject(forKey: "status")
        }

        let value = local.string(forKey: sourceKey)
        let lastCopied = local.string(forKey: copiedKey)
        // Copy when the app made a new session, or when the group lost it (for
        // example a copy made before the App Group was set up never landed).
        let groupMissing = value != nil && group.string(forKey: groupKey) == nil
        if value == lastCopied && !groupMissing { return }
        if let value = value {
            group.set(value, forKey: groupKey)
            local.set(value, forKey: copiedKey)
        } else {
            group.removeObject(forKey: groupKey)
            local.removeObject(forKey: copiedKey)
        }
    }
}
