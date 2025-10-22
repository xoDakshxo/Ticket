import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataSourcesManager } from "@/components/DataSourcesManager";

export default function Settings() {
  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure Reddit integrations and data sources
          </p>
        </div>

        {/* Data Sources Manager */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
            <CardDescription>
              Manage your Reddit sources and sync settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataSourcesManager />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
