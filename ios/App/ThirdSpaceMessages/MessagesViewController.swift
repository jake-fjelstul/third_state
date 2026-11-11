import Combine
import Messages
import SwiftUI
import UIKit

/// Third Space in the iMessage app drawer (plan Part 4, Layer B): the "+"
/// button in Messages shows four tiles, each sends an interactive bubble, and
/// tapping a bubble opens it here so people can vote, RSVP or join in place.
final class MessagesViewController: MSMessagesAppViewController {
    private let model = ExtensionModel()
    private var host: UIHostingController<RootView>?

    override func viewDidLoad() {
        super.viewDidLoad()
        model.requestExpanded = { [weak self] in self?.requestPresentationStyle(.expanded) }
        model.requestCompact = { [weak self] in self?.requestPresentationStyle(.compact) }
        model.insert = { [weak self] message in
            self?.activeConversation?.insert(message) { error in
                if let error = error { print("[ThirdSpaceMessages] insert failed", error) }
            }
            self?.requestPresentationStyle(.compact)
        }
        model.sendUpdate = { [weak self] message in
            self?.activeConversation?.send(message) { error in
                if let error = error { print("[ThirdSpaceMessages] update failed", error) }
            }
        }
        model.open = { [weak self] url in self?.extensionContext?.open(url, completionHandler: nil) }

        // Coming back from the app (where sign-in happens) doesn't always
        // re-run willBecomeActive, so re-check whenever Messages is in front.
        let model = self.model
        for name in [Notification.Name.NSExtensionHostDidBecomeActive, .NSExtensionHostWillEnterForeground] {
            NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
                Task { @MainActor in model.refreshSignIn() }
            }
        }

        let host = UIHostingController(rootView: RootView(model: model))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)
        self.host = host
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        model.refreshSignIn()
        show(conversation.selectedMessage)
        model.style = presentationStyle
    }

    override func didSelect(_ message: MSMessage, conversation: MSConversation) {
        super.didSelect(message, conversation: conversation)
        show(message)
    }

    override func willTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.willTransition(to: presentationStyle)
        model.style = presentationStyle
        // Back to the drawer when the person collapses an open bubble.
        if presentationStyle == .compact, case .detail = model.screen { model.screen = .drawer }
    }

    private func show(_ message: MSMessage?) {
        if let message = message, let kind = BubbleKind(url: message.url) {
            model.selectedSession = message.session
            model.screen = .detail(kind)
        } else {
            model.selectedSession = nil
            model.screen = .drawer
        }
    }
}

enum Tile: String, CaseIterable, Identifiable {
    case out, event, circle, poll
    var id: String { rawValue }
    var title: String {
        switch self {
        case .out: return "I'm out now"
        case .event: return "Event"
        case .circle: return "Circle invite"
        case .poll: return "When works?"
        }
    }
    var subtitle: String {
        switch self {
        case .out: return "Say where you are"
        case .event: return "Share a plan"
        case .circle: return "Bring them in"
        case .poll: return "Pick a time together"
        }
    }
    var symbol: String {
        switch self {
        case .out: return "location.fill"
        case .event: return "calendar"
        case .circle: return "person.3.fill"
        case .poll: return "clock.fill"
        }
    }
}

enum Screen: Equatable {
    case drawer
    case compose(Tile)
    case detail(BubbleKind)
}

@MainActor
final class ExtensionModel: ObservableObject {
    @Published var screen: Screen = .drawer
    @Published var style: MSMessagesAppPresentationStyle = .compact
    @Published var signedIn = false
    var selectedSession: MSSession?

    var requestExpanded: () -> Void = {}
    var requestCompact: () -> Void = {}
    var insert: (MSMessage) -> Void = { _ in }
    var sendUpdate: (MSMessage) -> Void = { _ in }
    var open: (URL) -> Void = { _ in }

    @Published var signInProblem: String?
    private var poll: Task<Void, Never>?

    /// Re-read the shared sign-in. While locked, keep checking every second so
    /// the tiles unlock as soon as the app hands the session over.
    func refreshSignIn() {
        let group = UserDefaults(suiteName: Config.appGroup)
        signedIn = ThirdSpaceAPI.shared.isSignedIn
        signInProblem = signedIn ? nil : group?.string(forKey: "status")
        if signedIn {
            poll?.cancel(); poll = nil
        } else if poll == nil {
            poll = Task { @MainActor [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    guard let model = self, !Task.isCancelled else { return }
                    model.refreshSignIn()
                }
            }
        }
    }

    func start(_ tile: Tile) {
        screen = .compose(tile)
        requestExpanded()
    }

    func openApp(_ path: String = "/feed") {
        if let url = URL(string: Config.site + path) { open(url) }
    }
}
