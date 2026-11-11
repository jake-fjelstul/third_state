# iMessage app: one-time Xcode setup

The Swift code in this folder is ready, but the Xcode target has to be added in
Xcode itself (it edits the project file and signing).

1. Open `ios/App/App.xcodeproj` (or the workspace) in Xcode.
2. **File → New → Target… → iOS → iMessage Extension.** Name it
   `ThirdSpaceMessages`, team RRRT73TTF6, embed in **App**. Bundle id becomes
   `com.thirdspace.social.ThirdSpaceMessages`.
3. Xcode creates its own `MessagesViewController.swift`, `MainInterface.storyboard`,
   `Info.plist` and an asset catalog. Delete its Swift file and the storyboard
   (Move to Trash), then drag every `.swift` file from this folder into the
   new target (target membership: ThirdSpaceMessages only).
4. In the target's **Build Settings**, set:
   - Info.plist File: `ThirdSpaceMessages/Info.plist` (the one in this folder;
     it uses `NSExtensionPrincipalClass` instead of a storyboard)
   - Code Signing Entitlements: `ThirdSpaceMessages/ThirdSpaceMessages.entitlements`
   - iOS Deployment Target: 15.0
5. **Signing & Capabilities → + Capability → App Groups**, tick
   `group.com.thirdspace.social` on **both** the App target and
   ThirdSpaceMessages (App.entitlements already lists it; this registers it
   with Apple).
6. iMessage app icons go in the extension's asset catalog (`iMessage App Icon`
   set: 1024×768 plus the smaller sizes Xcode asks for).
7. Run the **App** scheme once on a device or simulator and sign in. That gives
   the iMessage app its own sign-in. Then in Messages tap **+ → More → Third Space**.

How sign-in works: after you sign in, the app asks the `extension-session`
edge function for a second session for the same account, stores it under the
Preferences key `ts.ext.session`, and AppDelegate copies it into the App Group.
The extension refreshes that session itself, so it never signs the app out.
Signing out of the app removes it.
