import Foundation

/// The extension's own Supabase session. The app writes the first one into the
/// App Group (see ExtensionSessionBridge in AppDelegate.swift); from then on
/// the extension refreshes it and writes it back. It is never the app's session.
struct ExtSession: Codable {
    var access_token: String
    var refresh_token: String
    var expires_at: Double
    var user_id: String
}

enum APIError: LocalizedError {
    case signedOut
    case server(String)
    var errorDescription: String? {
        switch self {
        case .signedOut: return "Open Third Space to sign in."
        case .server(let m): return m
        }
    }
}

enum Config {
    static let supabaseURL = URL(string: "https://cxlzvegqgspuddbrxawr.supabase.co")!
    /// Publishable (anon) key, safe to ship: RLS and RPC checks do the work.
    static let publishableKey = "sb_publishable_cCv3dB71RtaMGoBipFh2ZQ_GOe0vcAc"
    static let site = "https://third-space-app.com"
    static let appGroup = "group.com.thirdspace.social"
}

actor ThirdSpaceAPI {
    static let shared = ThirdSpaceAPI()
    private let group = UserDefaults(suiteName: Config.appGroup)
    private var refreshing: Task<ExtSession, Error>?

    nonisolated var isSignedIn: Bool {
        UserDefaults(suiteName: Config.appGroup)?.string(forKey: "session") != nil
    }

    private func stored() -> ExtSession? {
        guard let raw = group?.string(forKey: "session"), let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(ExtSession.self, from: data)
    }

    private func save(_ s: ExtSession) {
        if let data = try? JSONEncoder().encode(s), let raw = String(data: data, encoding: .utf8) {
            group?.set(raw, forKey: "session")
        }
    }

    var userId: String? { stored()?.user_id }

    private func token(forceRefresh: Bool = false) async throws -> String {
        guard let s = stored() else { throw APIError.signedOut }
        if !forceRefresh && s.expires_at - 60 > Date().timeIntervalSince1970 { return s.access_token }
        if let running = refreshing { return try await running.value.access_token }
        let task = Task { () throws -> ExtSession in
            var req = URLRequest(url: Config.supabaseURL.appendingPathComponent("auth/v1/token"))
            req.url = URL(string: req.url!.absoluteString + "?grant_type=refresh_token")
            req.httpMethod = "POST"
            req.setValue(Config.publishableKey, forHTTPHeaderField: "apikey")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": s.refresh_token])
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard (resp as? HTTPURLResponse)?.statusCode == 200,
                  let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let access = obj["access_token"] as? String,
                  let refresh = obj["refresh_token"] as? String else {
                throw APIError.signedOut
            }
            let expiresAt = (obj["expires_at"] as? Double)
                ?? Date().timeIntervalSince1970 + ((obj["expires_in"] as? Double) ?? 3600)
            return ExtSession(access_token: access, refresh_token: refresh, expires_at: expiresAt, user_id: s.user_id)
        }
        refreshing = task
        defer { refreshing = nil }
        let fresh = try await task.value
        save(fresh)
        return fresh.access_token
    }

    /// POST /rest/v1/<path> or GET when body is nil. Retries once after a 401.
    private func request(_ path: String, method: String, body: Any?, anonymous: Bool = false, retried: Bool = false) async throws -> Data {
        guard let url = URL(string: Config.supabaseURL.absoluteString + "/rest/v1/" + path) else { throw APIError.server("Bad request") }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(Config.publishableKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let bearer = anonymous ? Config.publishableKey : try await token(forceRefresh: retried)
        req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        if let body = body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401 && !anonymous && !retried {
            return try await request(path, method: method, body: body, retried: true)
        }
        guard (200..<300).contains(code) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw APIError.server((obj?["message"] as? String) ?? "Something went wrong (\(code)).")
        }
        return data
    }

    func rpc(_ fn: String, _ params: [String: Any] = [:], anonymous: Bool = false) async throws -> Any? {
        let data = try await request("rpc/\(fn)", method: "POST", body: params, anonymous: anonymous)
        if data.isEmpty { return nil }
        return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }

    func get(_ path: String) async throws -> [[String: Any]] {
        let data = try await request(path, method: "GET", body: nil)
        return (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
    }

    func insert(_ table: String, _ row: [String: Any]) async throws {
        do { _ = try await request(table, method: "POST", body: row) }
        catch APIError.server(let m) where m.contains("duplicate") { /* already there */ }
    }
}

// MARK: - Typed calls

struct EventItem: Identifiable { let id: String; let title: String; let startsAt: Date?; let location: String; let circleName: String }
struct CircleItem: Identifiable { let id: String; let name: String }
struct PollOption: Identifiable { let index: Int; let at: Date; let count: Int; let mine: Bool; let names: [String]; var id: Int { index } }
struct Poll { let id: String; let title: String; let place: String; let mine: Bool; let set: Bool; let hostFirstName: String; let options: [PollOption] }

// Formatters are thread-safe for reading once configured.
nonisolated(unsafe) let isoParser: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
func parseDate(_ v: Any?) -> Date? {
    guard let s = v as? String else { return nil }
    if let d = isoParser.date(from: s) { return d }
    let plain = ISO8601DateFormatter()
    if let d = plain.date(from: s) { return d }
    // Postgres "2026-11-14 22:00:00+00"
    let pg = DateFormatter()
    pg.locale = Locale(identifier: "en_US_POSIX")
    pg.dateFormat = "yyyy-MM-dd HH:mm:ssXXXXX"
    return pg.date(from: s.replacingOccurrences(of: "T", with: " ").replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"([+-]\d\d)$"#, with: "$1:00", options: .regularExpression))
}
func isoString(_ d: Date) -> String { ISO8601DateFormatter().string(from: d) }

extension ThirdSpaceAPI {
    func checkIn(category: String, place: String, minutes: Int) async throws -> String {
        let id = try await rpc("create_checkin", [
            "p_category": category, "p_place_name": place, "p_minutes": minutes,
            "p_visibility": "everyone", "p_notify": false,
        ])
        guard let s = id as? String else { throw APIError.server("Couldn't check in.") }
        return s
    }

    func myUpcomingEvents() async throws -> [EventItem] {
        guard let uid = userId else { throw APIError.signedOut }
        let rows = try await get("event_attendees?select=events:event_id(id,title,starts_at,location,circles(name))&user_id=eq.\(uid)")
        let now = Date()
        return rows.compactMap { r -> EventItem? in
            guard let e = r["events"] as? [String: Any], let id = e["id"] as? String else { return nil }
            let starts = parseDate(e["starts_at"])
            if let starts = starts, starts < now.addingTimeInterval(-3600) { return nil }
            return EventItem(id: id, title: e["title"] as? String ?? "Event", startsAt: starts,
                             location: e["location"] as? String ?? "",
                             circleName: (e["circles"] as? [String: Any])?["name"] as? String ?? "")
        }.sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
    }

    func eventCard(_ id: String) async throws -> [String: Any]? {
        try await rpc("public_event_card", ["p_id": id], anonymous: true) as? [String: Any]
    }

    func rsvp(_ eventId: String) async throws {
        guard let uid = userId else { throw APIError.signedOut }
        try await insert("event_attendees", ["event_id": eventId, "user_id": uid])
    }

    func myCircles() async throws -> [CircleItem] {
        guard let uid = userId else { throw APIError.signedOut }
        let rows = try await get("circle_members?select=circles(id,name)&user_id=eq.\(uid)")
        return rows.compactMap { r in
            guard let c = r["circles"] as? [String: Any], let id = c["id"] as? String else { return nil }
            return CircleItem(id: id, name: c["name"] as? String ?? "Circle")
        }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func circleInviteCode(_ circleId: String) async throws -> String {
        let row = try await rpc("create_circle_invite_link", ["p_circle_id": circleId, "p_label": "iMessage"]) as? [String: Any]
        guard let code = row?["code"] as? String else { throw APIError.server("Couldn't make an invite.") }
        return code
    }

    func previewInvite(_ code: String) async throws -> [String: Any]? {
        let v = try await rpc("preview_invite", ["p_code": code], anonymous: true)
        return (v as? [String: Any]) ?? (v as? [[String: Any]])?.first
    }

    func redeemInvite(_ code: String) async throws {
        _ = try await rpc("redeem_invite_code", ["p_code": code])
    }

    func createPoll(title: String, place: String, options: [Date]) async throws -> String {
        let v = try await rpc("create_time_poll", [
            "p_title": title, "p_options": options.map(isoString), "p_place": place.isEmpty ? NSNull() : place,
        ])
        if let s = v as? String { return s }
        if let o = v as? [String: Any], let s = o["id"] as? String { return s }
        throw APIError.server("Couldn't make the poll.")
    }

    private func decodePoll(_ v: Any?) -> Poll? {
        guard let o = v as? [String: Any], let id = o["id"] as? String else { return nil }
        let opts = (o["options"] as? [[String: Any]] ?? []).enumerated().compactMap { (i, x) -> PollOption? in
            guard let at = parseDate(x["at"]) else { return nil }
            return PollOption(index: x["index"] as? Int ?? i, at: at, count: x["count"] as? Int ?? 0,
                              mine: x["mine"] as? Bool ?? false, names: x["names"] as? [String] ?? [])
        }
        let set = (o["eventId"] is String) || (o["set"] as? Bool ?? false)
        return Poll(id: id, title: o["title"] as? String ?? "Plans", place: o["place"] as? String ?? "",
                    mine: o["mine"] as? Bool ?? false, set: set,
                    hostFirstName: o["hostFirstName"] as? String ?? "", options: opts)
    }

    func poll(_ id: String) async throws -> Poll? {
        if isSignedIn { return decodePoll(try await rpc("get_time_poll", ["p_id": id])) }
        return decodePoll(try await rpc("public_time_poll_card", ["p_id": id], anonymous: true))
    }

    func vote(_ id: String, index: Int, on: Bool) async throws -> Poll? {
        decodePoll(try await rpc("vote_time_poll", ["p_poll_id": id, "p_option_index": index, "p_on": on]))
    }

    func lockIn(_ id: String, index: Int) async throws {
        _ = try await rpc("make_event_from_poll", ["p_poll_id": id, "p_option_index": index])
    }
}
