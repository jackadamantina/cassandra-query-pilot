
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
      <Select value={selectedCluster || undefined} onValueChange={onClusterChange}>
        <SelectTrigger className="w-[600px]">
          <SelectValue placeholder="Selecione um cluster" />
        </SelectTrigger>
        <SelectContent className="w-[600px]">
          {clusters.map((cluster) => (
            <SelectItem key={cluster.id} value={cluster.id.toString()}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    cluster.status === 'online' ? 'bg-green-500' : 
                    cluster.status === 'offline' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <div className="flex flex-col">
                    <span className="font-medium">{cluster.name}</span>
                    <span className="text-xs text-gray-500">
                      {cluster.hosts ? cluster.hosts.join(', ') : `${cluster.host}:${cluster.port}`}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-2">
                  {cluster.status === 'online' && `${cluster.onlineHosts}/${cluster.totalHosts} online`}
                  {cluster.status === 'offline' && 'Offline'}
                  {cluster.status === 'unknown' && 'Verificando...'}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
