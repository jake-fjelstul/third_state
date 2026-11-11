import Combine
import Messages
import SwiftUI
import UIKit

private let accent = Color(Brand.accent)

struct RootView: View {
    @ObservedObject var model: ExtensionModel

    var body: some View {
        Group {
            switch model.screen {
            case .drawer:
                DrawerView(model: model)
            case .compose(let tile):
                ComposeScreen(model: model, tile: tile)
            case .detail(let kind):
                DetailScreen(model: model, kind: kind)
            }
        }
        .tint(accent)
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: model.screen)
    }
}

// MARK: - Drawer (compact)

struct DrawerView: View {
    @ObservedObject var model: ExtensionModel
    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !model.signedIn {
                SignInBanner(model: model)
            }
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Tile.allCases) { tile in
                    Button { model.start(tile) } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Image(systemName: tile.symbol)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(accent)
                            Text(tile.title).font(.system(size: 16, weight: .bold)).foregroundColor(.primary)
                            Text(tile.subtitle).font(.system(size: 12, weight: .medium)).foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 84, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(.secondarySystemBackground)))
                    }
                    .buttonStyle(PressStyle())
                    .disabled(!model.signedIn)
                    .opacity(model.signedIn ? 1 : 0.45)
                }
            }
        }
        .padding(12)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}

struct SignInBanner: View {
    @ObservedObject var model: ExtensionModel
    var body: some View {
        Button { model.openApp() } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.crop.circle.badge.exclamationmark").foregroundColor(accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sign in on Third Space").font(.system(size: 14, weight: .bold)).foregroundColor(.primary)
                    Text("Open the app once and this unlocks.").font(.system(size: 12)).foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: "arrow.up.forward.app").foregroundColor(.secondary)
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color(.separator)))
        }
        .buttonStyle(PressStyle())
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

struct PrimaryButton: View {
    let title: String
    var busy = false
    var enabled = true
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            ZStack {
                if busy { ProgressView().tint(.white) } else { Text(title).font(.system(size: 17, weight: .semibold)) }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .foregroundColor(.white)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(accent.opacity(enabled ? 1 : 0.4)))
        }
        .buttonStyle(PressStyle())
        .disabled(busy || !enabled)
    }
}

struct Header: View {
    @ObservedObject var model: ExtensionModel
    let kicker: String
    let title: String
    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(kicker).font(.system(size: 12, weight: .heavy)).kerning(1).foregroundColor(accent)
                Text(title).font(.system(size: 24, weight: .heavy))
            }
            Spacer()
            Button { model.screen = .drawer; model.requestCompact() } label: {
                Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundColor(.secondary)
                    .frame(width: 32, height: 32).background(Circle().fill(Color(.secondarySystemBackground)))
            }
            .accessibilityLabel("Close")
        }
    }
}

struct ErrorText: View {
    let text: String
    var body: some View {
        if !text.isEmpty {
            Text(text).font(.system(size: 13, weight: .semibold)).foregroundColor(.red)
        }
    }
}

// MARK: - Composers (expanded)

struct ComposeScreen: View {
    @ObservedObject var model: ExtensionModel
    let tile: Tile
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Header(model: model, kicker: tile.title.uppercased(), title: tile.subtitle)
                switch tile {
                case .out: OutNowComposer(model: model)
                case .event: EventPicker(model: model)
                case .circle: CirclePicker(model: model)
                case .poll: PollComposer(model: model)
                }
            }
            .padding(16)
        }
    }
}

private let categories: [(String, String, String)] = [
    ("study", "Studying", "book.fill"), ("food", "Food & coffee", "cup.and.saucer.fill"),
    ("hang", "Hanging out", "sofa.fill"), ("active", "Active", "figure.run"),
]

struct OutNowComposer: View {
    @ObservedObject var model: ExtensionModel
    @State private var category = "hang"
    @State private var place = ""
    @State private var minutes = 60
    @State private var busy = false
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(categories, id: \.0) { c in
                    Button { category = c.0 } label: {
                        Label(c.1, systemImage: c.2)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundColor(category == c.0 ? .white : .primary)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(category == c.0 ? accent : Color(.secondarySystemBackground)))
                    }
                    .buttonStyle(PressStyle())
                }
            }
            TextField("Where are you? (Joe's Coffee, the library…)", text: $place)
                .textFieldStyle(.roundedBorder)
            Picker("For", selection: $minutes) {
                Text("30 min").tag(30); Text("1 hour").tag(60); Text("2 hours").tag(120); Text("3 hours").tag(180)
            }
            .pickerStyle(.segmented)
            Text("Anyone with the link can see where you are until it ends.")
                .font(.system(size: 12)).foregroundColor(.secondary)
            ErrorText(text: error)
            PrimaryButton(title: "Send", busy: busy, enabled: !place.trimmingCharacters(in: .whitespaces).isEmpty) { send() }
        }
    }

    private func send() {
        busy = true; error = ""
        let place = self.place.trimmingCharacters(in: .whitespaces)
        Task {
            do {
                let id = try await ThirdSpaceAPI.shared.checkIn(category: category, place: place, minutes: minutes)
                let label = categories.first { $0.0 == category }?.1 ?? "Out"
                let until = whenFormatter.string(from: Date().addingTimeInterval(Double(minutes) * 60))
                model.insert(BubbleBuilder.message(.checkin(id), title: "I'm at \(place)", detail: "\(label) · pull up", trailing: "until \(until.split(separator: " ").suffix(2).joined(separator: " "))"))
                model.screen = .drawer
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

struct EventPicker: View {
    @ObservedObject var model: ExtensionModel
    @State private var events: [EventItem]?
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let events = events {
                if events.isEmpty {
                    Text("Nothing coming up. Make a plan with When works?, or create an event in the app.")
                        .font(.system(size: 14)).foregroundColor(.secondary)
                    PrimaryButton(title: "Ask when works") { model.screen = .compose(.poll) }
                }
                ForEach(events) { e in
                    Button { send(e) } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(e.title).font(.system(size: 16, weight: .bold)).foregroundColor(.primary)
                            Text([whenLabel(e.startsAt), e.location, e.circleName].filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.system(size: 13)).foregroundColor(.secondary).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemBackground)))
                    }
                    .buttonStyle(PressStyle())
                }
            } else if error.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            }
            ErrorText(text: error)
        }
        .task {
            do { events = try await ThirdSpaceAPI.shared.myUpcomingEvents() }
            catch { self.error = error.localizedDescription }
        }
    }

    private func send(_ e: EventItem) {
        let detail = [whenLabel(e.startsAt), e.location].filter { !$0.isEmpty }.joined(separator: " · ")
        model.insert(BubbleBuilder.message(.event(e.id), title: e.title, detail: detail, trailing: "Tap to RSVP"))
        model.screen = .drawer
    }
}

struct CirclePicker: View {
    @ObservedObject var model: ExtensionModel
    @State private var circles: [CircleItem]?
    @State private var busy: String?
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let circles = circles {
                if circles.isEmpty {
                    Text("You're not in any circles yet.").font(.system(size: 14)).foregroundColor(.secondary)
                }
                ForEach(circles) { c in
                    Button { send(c) } label: {
                        HStack {
                            Image(systemName: "person.3.fill").foregroundColor(accent)
                            Text(c.name).font(.system(size: 16, weight: .bold)).foregroundColor(.primary)
                            Spacer()
                            if busy == c.id { ProgressView() } else { Image(systemName: "paperplane.fill").foregroundColor(.secondary) }
                        }
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemBackground)))
                    }
                    .buttonStyle(PressStyle())
                    .disabled(busy != nil)
                }
            } else if error.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            }
            ErrorText(text: error)
        }
        .task {
            do { circles = try await ThirdSpaceAPI.shared.myCircles() }
            catch { self.error = error.localizedDescription }
        }
    }

    private func send(_ c: CircleItem) {
        busy = c.id; error = ""
        Task {
            do {
                let code = try await ThirdSpaceAPI.shared.circleInviteCode(c.id)
                model.insert(BubbleBuilder.message(.invite(code), title: "Join \(c.name)", detail: "A circle on Third Space", trailing: "Tap to join"))
                model.screen = .drawer
            } catch { self.error = error.localizedDescription }
            busy = nil
        }
    }
}

struct PollComposer: View {
    @ObservedObject var model: ExtensionModel
    @State private var title = ""
    @State private var place = ""
    @State private var times: [Date] = PollComposer.defaultTimes()
    @State private var busy = false
    @State private var error = ""

    static func defaultTimes() -> [Date] {
        let cal = Calendar.current
        let now = Date()
        var tonight = cal.date(bySettingHour: 19, minute: 0, second: 0, of: now) ?? now
        if tonight < now.addingTimeInterval(3600) { tonight = cal.date(byAdding: .day, value: 1, to: tonight) ?? tonight }
        let next = cal.date(byAdding: .day, value: 1, to: tonight) ?? tonight
        return [tonight, next]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("What's the plan? (Climbing, dinner…)", text: $title).textFieldStyle(.roundedBorder)
            TextField("Where (optional)", text: $place).textFieldStyle(.roundedBorder)
            ForEach(times.indices, id: \.self) { i in
                HStack {
                    DatePicker("Option \(i + 1)", selection: $times[i], in: Date()..., displayedComponents: [.date, .hourAndMinute])
                        .font(.system(size: 15, weight: .semibold))
                    if times.count > 2 {
                        Button { times.remove(at: i) } label: { Image(systemName: "minus.circle.fill").foregroundColor(.secondary) }
                            .accessibilityLabel("Remove option \(i + 1)")
                    }
                }
            }
            if times.count < 4 {
                Button {
                    times.append(Calendar.current.date(byAdding: .day, value: 1, to: times.last ?? Date()) ?? Date())
                } label: { Label("Add a time", systemImage: "plus.circle.fill").font(.system(size: 15, weight: .semibold)) }
            }
            ErrorText(text: error)
            PrimaryButton(title: "Send poll", busy: busy, enabled: !title.trimmingCharacters(in: .whitespaces).isEmpty) { send() }
        }
    }

    private func send() {
        busy = true; error = ""
        let title = self.title.trimmingCharacters(in: .whitespaces)
        let place = self.place.trimmingCharacters(in: .whitespaces)
        let options = Array(Set(times)).sorted()
        guard options.count >= 2 else { error = "Pick two different times."; busy = false; return }
        Task {
            do {
                let id = try await ThirdSpaceAPI.shared.createPoll(title: title, place: place, options: options)
                model.insert(BubbleBuilder.message(.poll(id), title: "When works for \(title)?",
                                                   detail: options.map { whenLabel($0) }.joined(separator: " · "), trailing: "Tap to vote"))
                model.screen = .drawer
            } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}
