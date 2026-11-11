import Messages
import SwiftUI

private let accent = Color(Brand.accent)

/// A tapped bubble, opened in place.
struct DetailScreen: View {
    @ObservedObject var model: ExtensionModel
    let kind: BubbleKind

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch kind {
                case .poll(let id): PollDetail(model: model, id: id)
                case .event(let id): EventDetail(model: model, id: id)
                case .invite(let code): InviteDetail(model: model, code: code)
                case .checkin(let id): CheckinDetail(model: model, id: id)
                }
            }
            .padding(16)
        }
    }
}

struct OpenInAppButton: View {
    @ObservedObject var model: ExtensionModel
    let kind: BubbleKind
    var body: some View {
        Button { model.open(kind.url) } label: {
            Text("Open in Third Space").font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color(.separator)))
        }
        .buttonStyle(PressStyle())
    }
}

struct PollDetail: View {
    @ObservedObject var model: ExtensionModel
    let id: String
    @State private var poll: Poll?
    @State private var loaded = false
    @State private var busy: Int?
    @State private var changed = false
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let p = poll {
                Header(model: model, kicker: "WHEN WORKS?", title: p.title)
                Text([p.place, p.set ? "Time is set" : "\(p.hostFirstName.isEmpty ? "Someone" : p.hostFirstName) asked · tap every time that works"]
                    .filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.system(size: 14)).foregroundColor(.secondary)
                let best = p.options.map(\.count).max() ?? 0
                ForEach(p.options) { o in
                    HStack(spacing: 8) {
                        Button { toggle(o) } label: {
                            HStack(spacing: 10) {
                                Image(systemName: o.mine ? "checkmark.square.fill" : "square")
                                    .font(.system(size: 22)).foregroundColor(o.mine ? accent : .secondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(whenLabel(o.at)).font(.system(size: 16, weight: .semibold)).foregroundColor(.primary)
                                    Text(countLine(o)).font(.system(size: 13, weight: o.count == best && best > 0 ? .semibold : .regular))
                                        .foregroundColor(o.count == best && best > 0 ? accent : .secondary)
                                }
                                Spacer()
                                if busy == o.index { ProgressView() }
                            }
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(o.mine ? accent.opacity(0.12) : Color(.secondarySystemBackground)))
                        }
                        .buttonStyle(PressStyle())
                        .disabled(p.set || busy != nil || !model.signedIn)
                        if p.mine && !p.set {
                            Button("Pick") { lockIn(o) }
                                .font(.system(size: 14, weight: .bold))
                                .padding(.horizontal, 12).frame(minHeight: 52)
                                .foregroundColor(.white)
                                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(Brand.ink)))
                                .disabled(busy != nil)
                        }
                    }
                }
                ErrorText(text: error)
                if !model.signedIn {
                    SignInBanner(model: model)
                } else if changed {
                    PrimaryButton(title: "Done") { postUpdate(p, note: nil) }
                }
                OpenInAppButton(model: model, kind: .poll(id))
            } else if loaded {
                Header(model: model, kicker: "WHEN WORKS?", title: "This poll isn't available")
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .task {
            poll = try? await ThirdSpaceAPI.shared.poll(id)
            loaded = true
        }
    }

    private func countLine(_ o: PollOption) -> String {
        let people = "\(o.count) \(o.count == 1 ? "person" : "people")"
        guard !o.names.isEmpty else { return people }
        let shown = o.names.prefix(3).joined(separator: ", ")
        return "\(people) · \(shown)\(o.names.count > 3 ? " +\(o.names.count - 3)" : "")"
    }

    private func toggle(_ o: PollOption) {
        busy = o.index; error = ""
        Task {
            do {
                if let p = try await ThirdSpaceAPI.shared.vote(id, index: o.index, on: !o.mine) { poll = p; changed = true }
            } catch { self.error = error.localizedDescription.contains("already set") ? "The time is already set." : "Couldn't save your vote." }
            busy = nil
        }
    }

    private func lockIn(_ o: PollOption) {
        busy = o.index; error = ""
        Task {
            do {
                try await ThirdSpaceAPI.shared.lockIn(id, index: o.index)
                if let p = try await ThirdSpaceAPI.shared.poll(id) {
                    poll = p
                    postUpdate(p, note: whenLabel(o.at))
                }
            } catch { self.error = "Couldn't set the time. Try again." }
            busy = nil
        }
    }

    /// Replace the bubble in the chat (same MSSession) with the new tallies.
    private func postUpdate(_ p: Poll, note: String?) {
        let detail: String
        if let note = note {
            detail = "It's on · \(note)"
        } else {
            let best = p.options.max { $0.count < $1.count }
            detail = best.map { $0.count > 0 ? "Leading: \(whenLabel($0.at)) (\($0.count))" : "Tap to vote" } ?? "Tap to vote"
        }
        let title = note != nil ? "\(p.title) is on" : "When works for \(p.title)?"
        model.sendUpdate(BubbleBuilder.message(.poll(p.id), title: title, detail: detail, session: model.selectedSession))
        changed = false
        model.screen = .drawer
        model.requestCompact()
    }
}

struct EventDetail: View {
    @ObservedObject var model: ExtensionModel
    let id: String
    @State private var card: [String: Any]?
    @State private var loaded = false
    @State private var busy = false
    @State private var going = false
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let c = card {
                let title = c["title"] as? String ?? "Event"
                Header(model: model, kicker: "EVENT", title: title)
                let line = [whenLabel(parseDate(c["startsAt"])), c["location"] as? String ?? "", c["circleName"] as? String ?? ""]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                Text(line).font(.system(size: 15)).foregroundColor(.secondary)
                let count = (c["going"] as? Int ?? 0) + (going ? 1 : 0)
                if count > 0 { Text("\(count) going").font(.system(size: 14, weight: .semibold)).foregroundColor(accent) }
                ErrorText(text: error)
                if !model.signedIn {
                    SignInBanner(model: model)
                } else if going {
                    Label("You're going", systemImage: "checkmark.circle.fill").font(.system(size: 16, weight: .bold)).foregroundColor(accent)
                } else {
                    PrimaryButton(title: "I'm going", busy: busy) { rsvp(title: title, line: line, count: count + 1) }
                }
                OpenInAppButton(model: model, kind: .event(id))
            } else if loaded {
                Header(model: model, kicker: "EVENT", title: "This event isn't available")
                OpenInAppButton(model: model, kind: .event(id))
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .task {
            card = try? await ThirdSpaceAPI.shared.eventCard(id)
            loaded = true
        }
    }

    private func rsvp(title: String, line: String, count: Int) {
        busy = true; error = ""
        Task {
            do {
                try await ThirdSpaceAPI.shared.rsvp(id)
                going = true
                model.sendUpdate(BubbleBuilder.message(.event(id), title: title, detail: line, trailing: "\(count) going", session: model.selectedSession))
            } catch { self.error = "Couldn't RSVP here. Open it in Third Space." }
            busy = false
        }
    }
}

struct InviteDetail: View {
    @ObservedObject var model: ExtensionModel
    let code: String
    @State private var preview: [String: Any]?
    @State private var loaded = false
    @State private var busy = false
    @State private var joined = false
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            let circle = preview?["circle_name"] as? String
            let inviter = (preview?["inviter_name"] as? String)?.split(separator: " ").first.map(String.init)
            if loaded && preview == nil {
                Header(model: model, kicker: "CIRCLE INVITE", title: "This invite has expired")
            } else if loaded {
                Header(model: model, kicker: "CIRCLE INVITE", title: circle.map { "Join \($0)" } ?? "Join Third Space")
                if let inviter = inviter { Text("\(inviter) invited you.").font(.system(size: 15)).foregroundColor(.secondary) }
                ErrorText(text: error)
                if !model.signedIn {
                    SignInBanner(model: model)
                } else if joined {
                    Label("You're in", systemImage: "checkmark.circle.fill").font(.system(size: 16, weight: .bold)).foregroundColor(accent)
                } else {
                    PrimaryButton(title: "Join", busy: busy) { join() }
                }
                OpenInAppButton(model: model, kind: .invite(code))
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .task {
            preview = try? await ThirdSpaceAPI.shared.previewInvite(code)
            loaded = true
        }
    }

    private func join() {
        busy = true; error = ""
        Task {
            do { try await ThirdSpaceAPI.shared.redeemInvite(code); joined = true }
            catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

struct CheckinDetail: View {
    @ObservedObject var model: ExtensionModel
    let id: String
    @State private var card: [String: Any]?
    @State private var loaded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let c = card, c["live"] as? Bool == true {
                let who = (c["hostFirstName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "A friend"
                let place = c["placeName"] as? String
                Header(model: model, kicker: "OUT NOW", title: place.map { "\(who) is at \($0)" } ?? "\(who) is out right now")
                if let ends = parseDate(c["expiresAt"]) {
                    Text("Until \(DateFormatter.localizedString(from: ends, dateStyle: .none, timeStyle: .short))")
                        .font(.system(size: 15)).foregroundColor(.secondary)
                }
                PrimaryButton(title: "Pull up") { model.open(BubbleKind.checkin(id).url) }
            } else if loaded {
                Header(model: model, kicker: "OUT NOW", title: "This check-in has ended")
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .task {
            card = try? await ThirdSpaceAPI.shared.rpc("public_checkin_card", ["p_id": id], anonymous: true) as? [String: Any]
            loaded = true
        }
    }
}
