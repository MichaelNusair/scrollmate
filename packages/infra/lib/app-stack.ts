import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as rds from "aws-cdk-lib/aws-rds";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbCluster: rds.DatabaseCluster;
  dbSecurityGroup: ec2.SecurityGroup;
  appSecretsArn: string;
}

export class AppStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, "WebRepo", {
      repositoryName: "scrollmate-web",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 10 }],
    });

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

    const dbSecret = props.dbCluster.secret!;
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
        DATABASE_URL: ecs.Secret.fromSecretsManager(dbSecret, "connectionString"),
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

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSg", {
      vpc: props.vpc,
      description: "Security group for ECS Fargate service",
    });

    props.dbSecurityGroup.addIngressRule(
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
      circuitBreaker: { enable: true, rollback: true },
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
