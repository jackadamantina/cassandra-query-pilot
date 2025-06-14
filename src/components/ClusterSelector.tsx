
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cluster } from "@/lib/api";

interface ClusterSelectorProps {
  selectedCluster: string;
  onClusterChange: (cluster: string) => void;
  clusters: Cluster[];
}

export const ClusterSelector = ({ selectedCluster, onClusterChange, clusters }: ClusterSelectorProps) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="cluster-select" className="text-sm font-medium">
        Cluster Cassandra:
      </label>
      <Select value={selectedCluster} onValueChange={onClusterChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Selecione um cluster" />
        </SelectTrigger>
        <SelectContent>
          {clusters.map((cluster) => (
            <SelectItem key={cluster.id} value={cluster.id.toString()}>
              <div className="flex flex-col">
                <span className="font-medium">{cluster.name}</span>
                <span className="text-xs text-gray-500">
                  {cluster.hosts ? cluster.hosts.join(', ') : `${cluster.host}:${cluster.port}`}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
