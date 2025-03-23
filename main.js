import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EmailApi, EmailMessage } from 'sendpost_javascript_sdk';
import 'dotenv/config'

// Create an MCP server
const server = new McpServer({
  name: "Email Service",
  version: "1.0.0"
});

// Email configuration
const emailApi = new EmailApi();
const API_KEY = process.env.SENDPOST_API_KEY; // Replace with your actual API key or use env var

// Add email tool
server.tool(
  "send-email",
  {
    from: z.string().email(),
    to: z.array(z.string().email()),
    subject: z.string(),
    htmlBody: z.string(),
    ippool: z.string().optional()
  },
  async ({ from, to, subject, htmlBody, ippool = "default" }) => {
    try {
      const message = new EmailMessage();
      message.from = { email: from };
      message.to = to.map(email => ({ email }));
      message.subject = subject;
      message.htmlBody = htmlBody;
      // message.ippool = ippool;

      const opts = {
        emailMessage: message
      };

      const result = await emailApi.sendEmail(API_KEY, opts);
      
      return {
        content: [{ 
          type: "text", 
          text: `Email sent successfully to ${to.join(', ')} with Message ID: ${result[0].messageId || 'N/A'}`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Failed to send email: ${error.message}` 
        }],
        isError: true
      };
    }
  }
);

// Add email template resource
server.resource(
  "email-templates",
  "email-templates://list",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify([
        {
          name: "welcome",
          subject: "Welcome to our service!",
          body: "<h1>Welcome!</h1><p>We're glad to have you on board.</p>"
        },
        {
          name: "password-reset",
          subject: "Password Reset Request",
          body: "<h1>Reset Your Password</h1><p>Click the link below to reset your password.</p><p>{reset_link}</p>"
        }
      ], null, 2)
    }]
  })
);

// Add a prompt for email composition
server.prompt(
  "compose-email",
  { 
    recipient: z.string(),
    purpose: z.string(),
    tone: z.enum(["formal", "casual", "friendly"]).optional(),
    key_points: z.array(z.string()).optional()
  },
  ({ recipient, purpose, tone = "professional", key_points = [] }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please compose an email to ${recipient} for the purpose of ${purpose}. 
        The tone should be ${tone}.
        ${key_points.length > 0 ? 'Include these key points: ' + key_points.join(', ') : ''}
        
        Format the response as HTML that can be directly used in an email.`
      }
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);