#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { DatabaseStack } from "../lib/database-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { AppStack } from "../lib/app-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1",
};

const vpcStack = new VpcStack(app, "ScrollMateVpc", { env });

const secretsStack = new SecretsStack(app, "ScrollMateSecrets", { env });

const databaseStack = new DatabaseStack(app, "ScrollMateDatabase", {
  env,
  vpc: vpcStack.vpc,
});

new AppStack(app, "ScrollMateApp", {
  env,
  vpc: vpcStack.vpc,
  dbSecretArn: databaseStack.dbSecretArn,
  dbSecurityGroupId: databaseStack.dbSecurityGroupId,
  appSecretsArn: secretsStack.appSecrets.secretArn,
});
