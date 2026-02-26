import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class SecretsStack extends cdk.Stack {
  public readonly appSecrets: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.appSecrets = new secretsmanager.Secret(this, "AppSecrets", {
      secretName: "scrollmate/app-secrets",
      description: "Application secrets for ScrollMate (Azure OpenAI, Twitter OAuth, NextAuth)",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          AZURE_OPENAI_ENDPOINT: "https://your-resource.openai.azure.com",
          AZURE_OPENAI_API_KEY: "REPLACE_ME",
          AZURE_OPENAI_DEPLOYMENT: "gpt-4o-realtime",
          TWITTER_CLIENT_ID: "REPLACE_ME",
          TWITTER_CLIENT_SECRET: "REPLACE_ME",
          NEXTAUTH_SECRET: "REPLACE_ME",
          NEXTAUTH_URL: "https://scrollmate.example.com",
        }),
        generateStringKey: "_generated",
      },
    });

    new cdk.CfnOutput(this, "AppSecretsArn", {
      value: this.appSecrets.secretArn,
      description: "ARN of the application secrets",
    });
  }
}
