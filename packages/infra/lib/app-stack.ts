import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecretArn: string;
  dbSecurityGroupId: string;
  appSecretsArn: string;
}

export class AppStack extends cdk.Stack {
  public readonly repository: ecr.IRepository;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.repository = ecr.Repository.fromRepositoryName(
      this,
      "WebRepo",
      "scrollmate-web"
    );

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsights: true,
    });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-4-6-v1-*`,
        ],
      })
    );

    const appSecrets = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "AppSecrets",
      props.appSecretsArn
    );
    appSecrets.grantRead(taskRole);

    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      "DbSecret",
      props.dbSecretArn
    );
    dbSecret.grantRead(taskRole);

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, "WebLogs", {
      logGroupName: "/ecs/scrollmate-web",
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, "latest"),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "web",
        logGroup,
      }),
      environment: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
        DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
        DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
        AZURE_OPENAI_ENDPOINT: ecs.Secret.fromSecretsManager(appSecrets, "AZURE_OPENAI_ENDPOINT"),
        AZURE_OPENAI_API_KEY: ecs.Secret.fromSecretsManager(appSecrets, "AZURE_OPENAI_API_KEY"),
        AZURE_OPENAI_DEPLOYMENT: ecs.Secret.fromSecretsManager(appSecrets, "AZURE_OPENAI_DEPLOYMENT"),
        TWITTER_CLIENT_ID: ecs.Secret.fromSecretsManager(appSecrets, "TWITTER_CLIENT_ID"),
        TWITTER_CLIENT_SECRET: ecs.Secret.fromSecretsManager(appSecrets, "TWITTER_CLIENT_SECRET"),
        NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(appSecrets, "NEXTAUTH_SECRET"),
        NEXTAUTH_URL: ecs.Secret.fromSecretsManager(appSecrets, "NEXTAUTH_URL"),
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/auth/providers || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({ containerPort: 3000 });

    this.repository.grantPull(taskDefinition.executionRole!);
    appSecrets.grantRead(taskDefinition.executionRole!);
    dbSecret.grantRead(taskDefinition.executionRole!);

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSg", {
      vpc: props.vpc,
      description: "Security group for ECS Fargate service",
    });

    const dbSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "ImportedDbSg",
      props.dbSecurityGroupId
    );
    dbSecurityGroup.addIngressRule(
      serviceSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow access from ECS tasks"
    );

    this.service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: { enable: true, rollback: false },
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: props.vpc,
      internetFacing: true,
    });

    const listener = alb.addListener("HttpListener", {
      port: 80,
    });

    listener.addTargets("WebTarget", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: {
        path: "/api/auth/providers",
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    new cdk.CfnOutput(this, "AlbDnsName", {
      value: alb.loadBalancerDnsName,
      description: "Application Load Balancer DNS name",
    });

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: this.repository.repositoryUri,
      description: "ECR repository URI",
    });
  }
}
