import Messages
import UIKit

/// What a Third Space bubble points at. The bubble's URL is the same smart link
/// the app shares (third-space-app.com/s|e|j|p/...), so people without the
/// iMessage app still get a working link and a rich preview.
enum BubbleKind: Equatable {
    case checkin(String), event(String), invite(String), poll(String)

    init?(url: URL?) {
        guard let url = url else { return nil }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count == 2 else { return nil }
        switch parts[0] {
        case "s": self = .checkin(parts[1])
        case "e": self = .event(parts[1])
        case "j": self = .invite(parts[1])
        case "p": self = .poll(parts[1])
        default: return nil
        }
    }

    var url: URL {
        switch self {
        case .checkin(let id): return URL(string: "\(Config.site)/s/\(id)")!
        case .event(let id): return URL(string: "\(Config.site)/e/\(id)")!
        case .invite(let code): return URL(string: "\(Config.site)/j/\(code)")!
        case .poll(let id): return URL(string: "\(Config.site)/p/\(id)")!
        }
    }

    var symbol: String {
        switch self {
        case .checkin: return "location.fill"
        case .event: return "calendar"
        case .invite: return "person.3.fill"
        case .poll: return "clock.fill"
        }
    }

    var kicker: String {
        switch self {
        case .checkin: return "OUT NOW"
        case .event: return "EVENT"
        case .invite: return "CIRCLE INVITE"
        case .poll: return "WHEN WORKS?"
        }
    }
}

enum Brand {
    static let accent = UIColor(red: 1, green: 0x5A / 255.0, blue: 0x36 / 255.0, alpha: 1)
    static let ink = UIColor(red: 0x0B / 255.0, green: 0x0B / 255.0, blue: 0x0C / 255.0, alpha: 1)
}

enum BubbleBuilder {
    /// A bubble whose session lets later updates (votes, RSVPs) replace it in place.
    static func message(_ kind: BubbleKind, title: String, detail: String, trailing: String? = nil, session: MSSession? = nil) -> MSMessage {
        let message = MSMessage(session: session ?? MSSession())
        let layout = MSMessageTemplateLayout()
        layout.image = render(kind, title: title, detail: detail)
        layout.caption = title
        layout.subcaption = detail
        layout.trailingSubcaption = trailing
        message.layout = layout
        message.url = kind.url
        message.summaryText = "\(kind.kicker.capitalized): \(title)"
        return message
    }

    /// The card art: ink background, accent kicker and icon, large title.
    static func render(_ kind: BubbleKind, title: String, detail: String) -> UIImage {
        let size = CGSize(width: 600, height: 320)
        return UIGraphicsImageRenderer(size: size).image { ctx in
            Brand.ink.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))

            // Two overlapping rings, the Third Space mark, faint in the corner.
            ctx.cgContext.setStrokeColor(UIColor.white.withAlphaComponent(0.08).cgColor)
            ctx.cgContext.setLineWidth(18)
            ctx.cgContext.strokeEllipse(in: CGRect(x: 380, y: 120, width: 220, height: 220))
            ctx.cgContext.strokeEllipse(in: CGRect(x: 470, y: 120, width: 220, height: 220))

            let config = UIImage.SymbolConfiguration(pointSize: 34, weight: .semibold)
            if let icon = UIImage(systemName: kind.symbol, withConfiguration: config)?.withTintColor(Brand.accent, renderingMode: .alwaysOriginal) {
                icon.draw(at: CGPoint(x: 36, y: 36))
            }
            let kicker: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 22, weight: .heavy), .foregroundColor: Brand.accent, .kern: 1.5,
            ]
            (kind.kicker as NSString).draw(at: CGPoint(x: 92, y: 44), withAttributes: kicker)

            let para = NSMutableParagraphStyle()
            para.lineBreakMode = .byTruncatingTail
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 46, weight: .heavy), .foregroundColor: UIColor.white, .paragraphStyle: para,
            ]
            (title as NSString).draw(with: CGRect(x: 36, y: 110, width: 528, height: 116),
                                     options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: titleAttrs, context: nil)
            let detailAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 26, weight: .medium), .foregroundColor: UIColor.white.withAlphaComponent(0.7), .paragraphStyle: para,
            ]
            (detail as NSString).draw(with: CGRect(x: 36, y: 244, width: 528, height: 40),
                                      options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: detailAttrs, context: nil)
        }
    }
}

let whenFormatter: DateFormatter = {
    let f = DateFormatter()
    f.setLocalizedDateFormatFromTemplate("EEE MMM d h:mm a")
    return f
}()
func whenLabel(_ d: Date?) -> String { d.map { whenFormatter.string(from: $0) } ?? "" }
