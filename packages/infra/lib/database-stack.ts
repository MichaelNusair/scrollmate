import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: props.vpc,
      description: "Security group for Aurora PostgreSQL",
      allowAllOutbound: false,
    });

    this.cluster = new rds.DatabaseCluster(this, "ScrollMateDb", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      defaultDatabaseName: "scrollmate",
      credentials: rds.Credentials.fromGeneratedSecret("scrollmate_admin", {
        secretName: "scrollmate/db-credentials",
      }),
      storageEncrypted: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    new cdk.CfnOutput(this, "DbSecretArn", {
      value: this.cluster.secret!.secretArn,
      description: "ARN of the database credentials secret",
    });

    new cdk.CfnOutput(this, "DbClusterEndpoint", {
      value: this.cluster.clusterEndpoint.hostname,
      description: "Database cluster endpoint",
    });
  }
}
