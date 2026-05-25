const nodemailer = require("nodemailer");
const QRCode = require("qrcode");
const dns = require("dns");
const net = require("net");

const resolveIPv4 = (hostname) =>
    new Promise((resolve, reject) => {
        dns.resolve4(hostname, (err, addresses) => {
            if (err) return reject(err);
            if (!addresses || addresses.length === 0)
                return reject(new Error("No IPv4 addresses found"));
            resolve(addresses[0]);
        });
    });

// const createTransporter = () => {
//     return nodemailer.createTransport({
//         host: "smtp.gmail.com",  // force hostname instead of service
//         port: 465,
//         secure: true,
//         family: 4,               // force IPv4
//         auth: {
//             user: process.env.mailUser,
//             pass: process.env.mailPass,
//         },
//     });
// };

const createTransporter = () => {
    return new Promise((resolve, reject) => {
        dns.resolve4("smtp.gmail.com", (err, addresses) => {
            if (err) return reject(err);
            if (!addresses || addresses.length === 0)
                return reject(new Error("No IPv4 addresses found"));

            const transporter = nodemailer.createTransport({
                host: addresses[0],
                port: 587,
                secure: false,
                tls: {
                    servername: "smtp.gmail.com",
                },
                auth: {
                    user: process.env.mailUser,
                    pass: process.env.mailPass,
                },
            });

            resolve(transporter);
        });
    });
};

const formatEventDate = (dateValue) => {
    if (!dateValue) return "Date TBD";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "Date TBD";
    return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};

const formatEventTime = (dateValue) => {
    if (!dateValue) return "";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
};

const formatLocation = (location) => {
    if (!location) return "Venue not specified";
    if (typeof location === "string") return location;
    const { venue, address, city, state, country } = location;
    return [venue, address, city, state, country].filter(Boolean).join(", ");
};

const getOrganizerName = (createdBy) => {
    if (!createdBy) return "EventFlow";
    const first = createdBy.firstName || createdBy.name || "";
    const last = createdBy.lastName || "";
    return `${first}${last ? ` ${last}` : ""}`.trim() || "EventFlow";
};

const sendUserEmail = (booking) => {
    const user = booking.user || {};
    const event = booking.event || {};
    const createdBy = event.createdBy || {};

    const userName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || "Attendee";
    const userEmail = user.email;

    if (!userEmail) {
        console.warn(
            "sendUserEmail: no user email found for booking",
            booking._id,
        );
        return Promise.resolve();
    }

    const ticketCode = (booking.ticketCode || "").toString().trim();
    const eventTitle = event.title || "Event";
    const organizerName = getOrganizerName(createdBy);
    const eventLocation = formatLocation(event.location || event.venue);
    const eventDate = formatEventDate(event.startDateTime);
    const eventTime = formatEventTime(event.startDateTime);
    const ticketType = booking.ticketTypeName || "General Admission";
    const dateTime = eventTime ? `${eventDate}, ${eventTime}` : eventDate;

    return QRCode.toBuffer(ticketCode, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
    })
        .then((qrBuffer) => {
            const mailOptions = {
                from: `"EventFlow" <${process.env.mailUser}>`,
                to: userEmail,
                subject: `Your ticket for ${eventTitle} 🎟️`,
                attachments: [
                    {
                        filename: "qrcode.png",
                        content: qrBuffer,
                        cid: "qrcode@eventiq", // ✅ unique content ID
                    },
                ],
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Ticket</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Roboto','Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

          <!-- Greeting -->
          <tr>
            <td style="padding:0 0 16px;">
              <p style="margin:0;font-size:15px;color:#555;">Hi ${userName}, your booking is confirmed! Here's your ticket below.</p>
            </td>
          </tr>

          <!-- Ticket card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e0e0e0;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Top: header row -->
                <tr>
                  <td style="padding:20px 28px 14px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#666;">This is your ticket, ${userName}</td>
                        <td align="right" style="font-size:13px;font-weight:600;color:#333;letter-spacing:0.3px;">EventFlow</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Dashed divider -->
                <tr>
                  <td style="padding:0 14px;">
                    <hr style="border:none;border-top:1.5px dashed #d8d8d8;margin:0;" />
                  </td>
                </tr>

                <!-- Body: info left + QR right -->
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>

                        <!-- Left info -->
                        <td style="padding:20px 28px;vertical-align:top;">

                          <!-- Organiser -->
                          <p style="margin:0 0 4px;font-size:13px;color:#888;">
                            <span style="font-weight:600;">Host:</span> ${organizerName}
                          </p>

                          <!-- Event title -->
                          <h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#202124;line-height:1.3;">
                            ${eventTitle}
                          </h2>

                          <!-- Venue -->
                          <p style="margin:0 0 3px;font-size:13px;color:#555;line-height:1.5;">
                            ${eventLocation}
                          </p>

                          <!-- Date + Time -->
                          <p style="margin:0 0 20px;font-size:13px;font-weight:600;color:#202124;">
                            ${dateTime}
                          </p>

                          <!-- Info grid -->
                          <table cellpadding="0" cellspacing="0" style="width:100%;">
                            <tr>
                              <td style="padding-bottom:14px;vertical-align:top;width:50%;">
                                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Attendee</p>
                                <p style="margin:0;font-size:13px;font-weight:500;color:#202124;">${userName}</p>
                              </td>
                              <td style="padding-bottom:14px;vertical-align:top;width:50%;">
                                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Ticket Type</p>
                                <p style="margin:0;font-size:13px;font-weight:500;color:#202124;">${ticketType}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="vertical-align:top;width:50%;">
                                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Ticket Code</p>
                                <p style="margin:0;font-size:13px;font-weight:500;color:#202124;font-family:monospace;">${ticketCode}</p>
                              </td>
                              <td style="vertical-align:top;width:50%;">
                                <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Status</p>
                                <p style="margin:0;font-size:13px;font-weight:500;color:#34A853;">Confirmed</p>
                              </td>
                            </tr>
                          </table>
                        </td>

                        <!-- Dashed vertical divider -->
                        <td style="width:1px;background:transparent;border-left:1.5px dashed #d8d8d8;padding:0;"></td>

                        <!-- Right QR -->
                        <td style="width:200px;background:#fafafa;padding:20px 16px;text-align:center;vertical-align:middle;">
                          <img
                            src="cid:qrcode@eventiq"
                            alt="Ticket QR Code"
                            width="160"
                            height="160"
                            style="display:block;margin:0 auto;border-radius:4px;"
                          />
                          <p style="margin:8px 0 0;font-size:10px;color:#999;letter-spacing:0.3px;">Scan to check in</p>
                        </td>

                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fa;border-top:1px solid #e0e0e0;padding:10px 28px;text-align:center;">
                    <p style="margin:0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} EventFlow · All Rights Reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Bottom note -->
          <tr>
            <td style="padding:16px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                Present this QR code at the event entrance for check-in.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
            `,
            };

            return createTransporter().then((transporter) =>
                transporter.sendMail(mailOptions),
            );
        })
        .then((info) => {
            console.log("Ticket email sent to", userEmail, info.response);
        })
        .catch((err) => {
            console.error("sendUserEmail error:", err);
        });
};

const sendOrganizerEmail = (booking) => {
    const user = booking.user || {};
    const event = booking.event || {};
    const createdBy = event.createdBy || {};

    const organizerEmail = createdBy.email;
    if (!organizerEmail) {
        console.warn(
            "sendOrganizerEmail: no organizer email for booking",
            booking._id,
        );
        return Promise.resolve();
    }

    const attendeeName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "An attendee";
    const organizerName = getOrganizerName(createdBy);
    const eventTitle = event.title || "your event";
    const ticketCode = (booking.ticketCode || "").toString().trim();
    const ticketType = booking.ticketTypeName || "General Admission";
    const eventDate = formatEventDate(event.startDateTime);

    return createTransporter().then((transporter) => {
        return transporter
            .sendMail({
                from: `"EventFlow" <${process.env.mailUser}>`,
                to: organizerEmail,
                subject: `New booking for ${eventTitle} 🎉`,
                html: `
<div style="background-color:#f4f4f4;padding:32px 16px;font-family:'Roboto','Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e0e0e0;overflow:hidden;">
    <div style="padding:24px 28px;border-bottom:1px solid #f0f0f0;">
      <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#202124;">New Booking Received</h2>
      <p style="margin:0;font-size:13px;color:#888;">Hi ${organizerName}, someone just booked a ticket for your event.</p>
    </div>
    <div style="padding:24px 28px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
        <tr><td style="color:#888;padding:6px 0;width:40%;">Event</td><td style="color:#202124;font-weight:500;">${eventTitle}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Date</td><td style="color:#202124;font-weight:500;">${eventDate}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Attendee</td><td style="color:#202124;font-weight:500;">${attendeeName}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Ticket Type</td><td style="color:#202124;font-weight:500;">${ticketType}</td></tr>
        <tr><td style="color:#888;padding:6px 0;">Ticket Code</td><td style="color:#202124;font-weight:500;font-family:monospace;">${ticketCode}</td></tr>
      </table>
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e0e0e0;padding:10px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} EventFlow · All Rights Reserved.</p>
    </div>
  </div>
</div>
            `,
            })
            .then(() => {
                console.log("Organizer email sent to", organizerEmail);
            })
            .catch((err) => {
                console.error("sendOrganizerEmail error:", err);
            });
    });
};

module.exports = { sendUserEmail, sendOrganizerEmail };
