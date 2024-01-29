### watch-sites

Make a head request to a list of HTTPS domains and write a log of the status.

Send an email (via SMTP) if status is not 200.

Dependencies: `nodemailer`, `dotenv`

---

### Usage

1. `npm install`

2. Create a `.env` file and add a list of domains to check, SMTP Details (Host/Port/Secure), sending email address (EMAIL_USER), email password, and recipient email (EMAIL_TO). Secure should passed 0 for false or 1 for true. Note - Only pass true(1) if you are using port 465. Connections that support STARTTLS are upgraded to TLS using that protocol, so its not "insecure".

```
DOMAINS=https://cloudflare.com,https://letsencrypt.org,https://developer.mozilla.org
SMTP_HOST=smtp.email.com
SMTP_PORT=587
SMTP_SECURE=0
EMAIL_USER=address@email.com
EMAIL_PASSWORD=emailPass123
EMAIL_TO=sendTo@email.com
```

(DOMAINS must be a list in CSV, sites must be HTTPS)

3. Run with `node index`
4. PM2 (optional) 1. We can use the following command from the same directory as the log will be, to make PM2 not watch the log file but watch the rest:\
   `pm2 start watch-sites --watch --ignore-watch="watch-sites.log"`

---

### About

I wanted a tool to monitor some of the sites I host on my VPS.

I wanted it to not rely on 3rd party packages. This included another attempt at getting my VPS working as a mailserver. While unsuccessful, I was able to get mail to send, just not trusted by Google. I _think_ Ijust need to fix the rDNS/PTR records, it was able to send successfully to a throw away email service, which was pretty neat.

Initially had code to give a more interactive feedback to the console (time remaining would print over the last line instead of making a new one) but those didn't play nice with PM2, so its commented out for now. Might add back with some optional flag.

---

### todo:

- zip/archive/rotate the log based on time or size intervals
  - One logfile per day may work well, with options to change
- A header line in each log file with details about the log file itself?
  - Like time frame the log covers, number of entries, list of domains, but these things might be better for a log parser. Lets just make a header line with just the date period the log encompasses instead.
- Batch emails for non-200 warnings, so one email with a list of each domain and the status in the body. We could put the number of domains that failed in the subject line.
- Log parser to query and display the data
