const AWS = require("aws-sdk");
const url = require("url");
const https = require("https");
const config = require("./config");

var hookUrl;
const baseDiscordMessage = {};

const colors = {
  good: 5168997,
  warning: 15647573,
  danger: 14955328
};

const postMessage = (message, callback) => {
  const body = JSON.stringify(message);
  const options = url.parse(hookUrl);
  options.method = "POST";
  options.headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  };

  const postReq = https.request(options, res => {
    const chunks = [];
    res.setEncoding("utf8");
    res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => {
      const body = chunks.join("");
      if (callback) {
        callback({
          body: body,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage
        });
      }
    });
    return res;
  });

  postReq.write(body);
  postReq.end();
};

const handleElasticBeanstalk = event => {
  const timestamp = new Date(event.Records[0].Sns.Timestamp);
  const subject =
    event.Records[0].Sns.Subject || "AWS Elastic Beanstalk Notification";
  const message = event.Records[0].Sns.Message;

  const stateRed = message.indexOf(" to RED");
  const stateSevere = message.indexOf(" to Severe");
  const butWithErrors = message.indexOf(" but with errors");
  const noPermission = message.indexOf("You do not have permission");
  const failedDeploy = message.indexOf("Failed to deploy application");
  const failedConfig = message.indexOf("Failed to deploy configuration");
  const failedQuota = message.indexOf(
    "Your quota allows for 0 more running instance"
  );
  const unsuccessfulCommand = message.indexOf("Unsuccessful command execution");

  const stateYellow = message.indexOf(" to YELLOW");
  const stateDegraded = message.indexOf(" to Degraded");
  const stateInfo = message.indexOf(" to Info");
  const removedInstance = message.indexOf("Removed instance ");
  const addingInstance = message.indexOf("Adding instance ");
  const abortedOperation = message.indexOf(" aborted operation.");
  const abortedDeployment = message.indexOf(
    "some instances may have deployed the new application version"
  );

  let color = colors.good;

  if (
    stateRed != -1 ||
    stateSevere != -1 ||
    butWithErrors != -1 ||
    noPermission != -1 ||
    failedDeploy != -1 ||
    failedConfig != -1 ||
    failedQuota != -1 ||
    unsuccessfulCommand != -1
  ) {
    color = colors.danger;
  }
  if (
    stateYellow != -1 ||
    stateDegraded != -1 ||
    stateInfo != -1 ||
    removedInstance != -1 ||
    addingInstance != -1 ||
    abortedOperation != -1 ||
    abortedDeployment != -1
  ) {
    color = colors.warning;
  }

  const discordMessage = {
    username: "Elastic Beanstalk",
    content: `**${subject}**`,
    embeds: [
      {
        fields: [
          {
            name: "Subject",
            value: event.Records[0].Sns.Subject,
            inline: true
          },
          { name: "Message", value: message }
        ],
        color,
        timestamp
      }
    ]
  };

  return { ...discordMessage, ...baseDiscordMessage };
};

const handleCodeDeploy = event => {
  const subject = "AWS CodeDeploy Notification";
  const timestamp = event.Records[0].Sns.Timestamp;
  const snsSubject = event.Records[0].Sns.Subject;
  let message;
  const fields = [];
  let color = colors.warning;

  try {
    message = JSON.parse(event.Records[0].Sns.Message);

    if (message.status === "SUCCEEDED") {
      color = colors.good;
    } else if (message.status === "FAILED") {
      color = colors.danger;
    }
    fields.push({ name: "Message", value: snsSubject, inline: true });
    fields.push({
      name: "Deployment Group",
      value: message.deploymentGroupName
    });
    fields.push({
      name: "Application",
      value: message.applicationName
    });
    fields.push({
      name: "Status Link",
      value:
        "https://console.aws.amazon.com/codedeploy/home?region=" +
        message.region +
        "#/deployments/" +
        message.deploymentId,
      inline: true
    });
  } catch (e) {
    color = colors.good;
    message = event.Records[0].Sns.Message;
    fields.push({ name: "Message", value: snsSubject, inline: true });
    fields.push({ name: "Detail", value: message, inline: true });
  }

  const discordMessage = {
    username: "Code Deploy",
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: fields,
        timestamp
      }
    ]
  };

  return { ...discordMessage, ...baseDiscordMessage };
};

const handleCodePipeline = event => {
  const subject = "AWS CodePipeline Notification";
  const timestamp = event.Records[0].Sns.Timestamp;
  let message;
  const fields = [];
  let color = colors.warning;
  let changeType = "";

  try {
    message = JSON.parse(event.Records[0].Sns.Message);
    detailType = message["detail-type"];

    if (detailType === "CodePipeline Pipeline Execution State Change") {
      changeType = "";
    } else if (detailType === "CodePipeline Stage Execution State Change") {
      changeType = "STAGE " + message.detail.stage;
    } else if (detailType === "CodePipeline Action Execution State Change") {
      changeType = "ACTION";
    }

    if (message.detail.state === "SUCCEEDED") {
      color = colors.good;
    } else if (message.detail.state === "FAILED") {
      color = colors.danger;
    }
    header = message.detail.state + ": CodePipeline " + changeType;
    fields.push({ name: "Message", value: header, inline: true });
    fields.push({
      name: "Pipeline",
      value: message.detail.pipeline
    });
    fields.push({ name: "Region", value: message.region });
    fields.push({
      name: "Status Link",
      value:
        "https://console.aws.amazon.com/codepipeline/home?region=" +
        message.region +
        "#/view/" +
        message.detail.pipeline,
      inline: true
    });
  } catch (e) {
    color = colors.good;
    message = event.Records[0].Sns.Message;
    header = message.detail.state + ": CodePipeline " + message.detail.pipeline;
    fields.push({ name: "Message", value: header, inline: true });
    fields.push({ name: "Detail", value: message, inline: true });
  }

  const discordMessage = {
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: fields,
        timestamp
      }
    ]
  };

  return { ...discordMessage, ...baseDiscordMessage };
};

const handleElasticache = event => {
  const subject = "AWS ElastiCache Notification";
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = event.Records[0].Sns.Timestamp;
  const region = event.Records[0].EventSubscriptionArn.split(":")[3];
  let eventname, nodename;
  const color = colors.good;

  for (key in message) {
    eventname = key;
    nodename = message[key];
    break;
  }
  const discordMessage = {
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: [
          { name: "Event", value: eventname.split(":")[1] },
          { name: "Node", value: nodename },
          {
            name: "Link to cache node",
            value:
              "https://console.aws.amazon.com/elasticache/home?region=" +
              region +
              "#cache-nodes:id=" +
              nodename +
              ";nodes",
            inline: true
          }
        ],
        timestamp
      }
    ]
  };
  return { ...discordMessage, ...baseDiscordMessage };
};

const handleCloudWatchEventECS = event => {
  const timestamp = event.Records[0].Sns.Timestamp;
  const message = JSON.parse(event.Records[0].Sns.Message);
  const subject = "AWS CloudWatch Notification";
  const fields = [];

  try {
    message = JSON.parse(event.Records[0].Sns.Message);
    const detailType = message["detail-type"];
    const status = message.detail.lastStatus;

    let color = colors.danger;

    if (status === "RUNNING") {
      color = colors.good;
    } else if (status === "PENDING") {
      color = colors.warning;
    }

    const container = message.detail.containers[0].name;
    const stoppedReason = message.detail.stoppedReason;

    fields.push({ name: detailType, value: ".", inline: true });
    fields.push({ name: "Container", value: container, inline: true });
    fields.push({ name: "Status", value: status, inline: true });
    if (stoppedReason) {
      fields.push({ name: "Reason", value: stoppedReason, inline: true });
    }

    const discordMessage = {
      content: `**${subject}**`,
      embeds: [
        {
          color,
          fields: fields,
          timestamp
        }
      ]
    };

    return { ...discordMessage, ...baseDiscordMessage };
  } catch (e) {
    console.log(e);
    return handleCatchAll(event);
  }
};

const handleCloudWatch = event => {
  const timestamp = event.Records[0].Sns.Timestamp;
  const message = JSON.parse(event.Records[0].Sns.Message);
  const region = event.Records[0].EventSubscriptionArn.split(":")[3];
  const subject = "AWS CloudWatch Notification";
  const alarmName = message.AlarmName;
  const metricName = message.Trigger.MetricName;
  const oldState = message.OldStateValue;
  const newState = message.NewStateValue;
  const alarmDescription = message.AlarmDescription;
  const trigger = message.Trigger;
  const color = colors.warning;

  if (message.NewStateValue === "ALARM") {
    color = colors.danger;
  } else if (message.NewStateValue === "OK") {
    color = colors.good;
  }

  const discordMessage = {
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: [
          { name: "Alarm Name", value: alarmName },
          { name: "Alarm Description", value: alarmDescription, inline: true },
          {
            name: "Trigger",
            value:
              trigger.Statistic +
              " " +
              metricName +
              " " +
              trigger.ComparisonOperator +
              " " +
              trigger.Threshold +
              " for " +
              trigger.EvaluationPeriods +
              " period(s) of " +
              trigger.Period +
              " seconds.",
            inline: true
          },
          { name: "Old State", value: oldState },
          { name: "Current State", value: newState },
          {
            name: "Link to Alarm",
            value:
              "https://console.aws.amazon.com/cloudwatch/home?region=" +
              region +
              "#alarm:alarmFilter=ANY;name=" +
              encodeURIComponent(alarmName),
            inline: true
          }
        ],
        timestamp
      }
    ]
  };
  return { ...discordMessage, ...baseDiscordMessage };
};

const handleAutoScaling = event => {
  const subject = "AWS AutoScaling Notification";
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = event.Records[0].Sns.Timestamp;
  const color = colors.good;

  for (key in message) {
    eventname = key;
    nodename = message[key];
    break;
  }
  const discordMessage = {
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: [
          {
            name: "Message",
            value: event.Records[0].Sns.Subject,
            inline: true
          },
          { name: "Description", value: message.Description, inline: true },
          { name: "Event", value: message.Event, inline: true },
          { name: "Cause", value: message.Cause, inline: true }
        ],
        timestamp
      }
    ]
  };
  return { ...discordMessage, ...baseDiscordMessage };
};

const handleCatchAll = event => {
  const record = event.Records[0];
  const subject = record.Sns.Subject;
  const timestamp = record.Sns.Timestamp;
  const message = JSON.parse(record.Sns.Message);
  let color = colors.warning;

  if (message.NewStateValue === "ALARM") {
    color = colors.danger;
  } else if (message.NewStateValue === "OK") {
    color = colors.good;
  }

  // Add all of the values from the event message to the Discord message description
  let description = "";
  for (key in message) {
    const renderedMessage =
      typeof message[key] === "object"
        ? JSON.stringify(message[key])
        : message[key];

    description = description + "\n" + key + ": " + renderedMessage;
  }

  const discordMessage = {
    content: `**${subject}**`,
    embeds: [
      {
        color,
        fields: [
          {
            name: "Description",
            value: description.substring(0, 1024),
            inline: true
          }
        ],
        timestamp
      }
    ]
  };

  return { ...discordMessage, ...baseDiscordMessage };
};

const processEvent = (event, context) => {
  console.log("sns received:" + JSON.stringify(event, null, 2));
  let discordMessage = null;
  const eventSubscriptionArn = event.Records[0].EventSubscriptionArn;
  const eventSnsSubject = event.Records[0].Sns.Subject || "no subject";
  const eventSnsMessageRaw = event.Records[0].Sns.Message;
  const eventSnsMessage = null;

  try {
    eventSnsMessage = JSON.parse(eventSnsMessageRaw);
  } catch (e) {}

  if (
    eventSubscriptionArn.indexOf(config.services.codepipeline.match_text) >
      -1 ||
    eventSnsSubject.indexOf(config.services.codepipeline.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.codepipeline.match_text) > -1
  ) {
    console.log("processing codepipeline notification");
    discordMessage = handleCodePipeline(event);
  } else if (
    eventSubscriptionArn.indexOf(config.services.elasticbeanstalk.match_text) >
      -1 ||
    eventSnsSubject.indexOf(config.services.elasticbeanstalk.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.elasticbeanstalk.match_text) > -1
  ) {
    console.log("processing elasticbeanstalk notification");
    discordMessage = handleElasticBeanstalk(event);
  } else if (
    eventSnsMessage &&
    "AlarmName" in eventSnsMessage &&
    "AlarmDescription" in eventSnsMessage
  ) {
    console.log("processing cloudwatch notification");
    discordMessage = handleCloudWatch(event);
  } else if (
    eventSnsMessage &&
    "source" in eventSnsMessage &&
    eventSnsMessage.source === "aws.ecs"
  ) {
    console.log("processing cloudwatch ECS event notification");
    discordMessage = handleCloudWatchEventECS(event);
  } else if (
    eventSubscriptionArn.indexOf(config.services.codedeploy.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.codedeploy.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.codedeploy.match_text) > -1
  ) {
    console.log("processing codedeploy notification");
    discordMessage = handleCodeDeploy(event);
  } else if (
    eventSubscriptionArn.indexOf(config.services.elasticache.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.elasticache.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.elasticache.match_text) > -1
  ) {
    console.log("processing elasticache notification");
    discordMessage = handleElasticache(event);
  } else if (
    eventSubscriptionArn.indexOf(config.services.autoscaling.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.autoscaling.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.autoscaling.match_text) > -1
  ) {
    console.log("processing autoscaling notification");
    discordMessage = handleAutoScaling(event);
  } else {
    console.log("processing catch all notification");
    discordMessage = handleCatchAll(event);
  }

  postMessage(discordMessage, response => {
    if (response.statusCode < 400) {
      console.info("message posted successfully");
      context.succeed();
    } else if (response.statusCode < 500) {
      console.error(
        "error posting message to discord API: " +
          response.statusCode +
          " - " +
          response.statusMessage
      );
      // Don't retry because the error is due to a problem with the request
      context.succeed();
    } else {
      // Let Lambda retry
      context.fail(
        "server error when processing message: " +
          response.statusCode +
          " - " +
          response.statusMessage
      );
    }
  });
};

exports.handler = (event, context) => {
  if (hookUrl) {
    processEvent(event, context);
  } else if (config.unencryptedHookUrl) {
    hookUrl = config.unencryptedHookUrl;
    processEvent(event, context);
  } else if (
    config.kmsEncryptedHookUrl &&
    config.kmsEncryptedHookUrl !== "<kmsEncryptedHookUrl>"
  ) {
    const encryptedBuf = new Buffer(config.kmsEncryptedHookUrl, "base64");
    const cipherText = { CiphertextBlob: encryptedBuf };
    const kms = new AWS.KMS();

    kms.decrypt(cipherText, (err, data) => {
      if (err) {
        console.log("decrypt error: " + err);
        processEvent(event, context);
      } else {
        hookUrl = "https://" + data.Plaintext.toString("ascii");
        processEvent(event, context);
      }
    });
  } else {
    context.fail("hook url has not been set.");
  }
};
