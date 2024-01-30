require("dotenv").config();
const nodemailer = require("nodemailer");
const fs = require("fs");

const logFilePath = "watch-sites.log";

const https = require("https");

const requiredEnvVars = [
  "DOMAINS",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_secure",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_TO",
  "SEND_GROUPED_MAIL",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is not defined in the .env file`);
    process.exit(1);
  }
}

const domains = process.env.DOMAINS.split(",");
const checkInterval = 60000;
let remainingTime = checkInterval / 1000;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: parseInt(process.env.SMTP_SECURE),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function checkWebsite(url) {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const { hostname, path } = new URL(url);

    const options = {
      method: "HEAD",
      hostname: hostname,
      path: path,
    };

    const req = https.request(options, (res) => {
      const responseTime = Date.now() - startTime;

      if (res.statusCode === 200) {
        resolve({
          domain: url,
          statusCode: res.statusCode,
          responseTime: responseTime,
        });
      } else {
        reject({
          domain: url,
          statusCode: res.statusCode,
          responseTime: responseTime,
        });
      }
    });

    req.on("error", (error) => {
      reject({
        domain: url,
        requestFailure: true,
        httpReqError: error,
      });
    });

    req.end();
  });
}

function sendSingleErrorEmail(domain, statusCode) {
  const subject = `ALERT: ${domain} FAILED, CODE ${statusCode}`;

  const dateString = new Date(Date.now()).toLocaleDateString();
  const timeString = new Date(Date.now()).toLocaleTimeString();
  const dateAndTimeString = `Date: ${dateString} - Time: ${timeString}`;

  let body = "";

  body += `${dateAndTimeString}\n\n`;

  body += `Error for ${domain}: Status code: ${statusCode}\n`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: subject,
    text: body,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(`Error sending email: ${error.message}`);
    } else {
      console.log(`Email sent for ${domain}: ${info.response}`);
    }
  });
}

function sendGroupedErrorEmail(failedResults) {
  const subject = `ALERT: ${failedResults.length} site${
    failedResults.length > 1 ? "s" : ""
  } failed`;

  const dateString = new Date(Date.now()).toLocaleDateString();
  const timeString = new Date(Date.now()).toLocaleTimeString();
  const dateAndTimeString = `Date: ${dateString} - Time: ${timeString}`;

  let body = "";

  body += `${dateAndTimeString}\n\n`;

  body += "Failed websites:\n\n";

  failedResults.forEach((result) => {
    body += `Error for ${result.domain}: Status code: ${result.statusCode}\n`;
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: subject,
    text: body,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(`Error sending email: ${error.message}`);
    } else {
      console.log(
        `Email sent for ${failedResults.length} failed sites: ${info.response}`
      );
    }
  });
}

//*********************************************************/
// An attempt at using sendmail, this works but my rDNS/PTR
// needs fixing for gmail to accept mail from my server...

// Pulled this line from from up top so its all together^
// const childProcess = require("child_process");

// function sendErrorEmail(domain, message) {
//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: process.env.EMAIL_TO,
//     subject: `Website Check Failure - ${domain}`,
//     text: message,
//   };

//   const mailCommand = `echo "${mailOptions.text}" | sendmail -t -i -f ${mailOptions.from} -s "${mailOptions.subject}" -r ${mailOptions.to}`;

//   childProcess.exec(mailCommand, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`Error sending email: ${error.message}`);
//     } else {
//       console.log(`Email sent for ${domain}`);
//     }
//   });
// }
//*********************************************************/

function logResult(statusCode, domain, responseTime) {
  const currentDate = new Date().toISOString();
  const logEntry = `${statusCode},${domain},${currentDate},${responseTime}ms\n`;

  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error(`Error writing to log file: ${err.message}`);
    } else {
      console.log(`Result logged for ${domain}`);
    }
  });
}

async function checkAllWebsites() {
  const promises = domains.map((domain) => checkWebsite(domain));

  return Promise.allSettled(promises);
}

function runChecks() {
  const failedResults = [];

  checkAllWebsites()
    .then((results) => {
      results.forEach((result) => {
        if (result.requestFailure) {
          const { domain, httpReqError } = result.reason;

          logResult(`REQERR: ${domain}`, `${httpReqError}`);
        } else if (result.status === "fulfilled") {
          const { domain, statusCode, responseTime } = result.value;

          console.log(`${domain} is online. Status code: ${statusCode}`);

          logResult(statusCode, domain, responseTime);
        } else {
          const { domain, statusCode, responseTime } = result.reason;

          console.error(`Error for ${domain}: Status code: ${statusCode}`);

          if (parseInt(process.env.SEND_GROUPED_MAIL)) {
            failedResults.push({ domain, statusCode });
          } else {
            sendSingleErrorEmail(domain, statusCode);
          }

          logResult(statusCode, domain, responseTime);
        }
      });

      if (failedResults.length > 0 && parseInt(process.env.SEND_GROUPED_MAIL)) {
        sendGroupedErrorEmail(failedResults);
      }

      remainingTime = checkInterval / 1000;
    })
    .catch((error) => {
      console.error(`Error: ${error.message}`);
      remainingTime = checkInterval / 1000;
    });
}

runChecks();

setInterval(() => {
  remainingTime--;
  if (remainingTime > 0) {
    console.log(`Next check in ${remainingTime} seconds`);
  } else {
    runChecks();
  }
}, 1000);
