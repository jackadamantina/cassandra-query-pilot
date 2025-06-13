
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Cluster {
  name: string;
  hosts: string[];
}

const clusters: Cluster[] = [
  {
    name: "omni",
    hosts: ["10.33.245.191:9042", "10.33.245.192:9042", "10.33.245.193:9042"]
  },
  {
    name: "btg", 
    hosts: ["10.33.245.220:9041", "10.33.245.221:9042", "10.33.245.222:9042"]
  },
  {
    name: "click",
    hosts: ["10.33.245.230:9042", "10.33.245.231:9042", "10.33.245.243:9042"]
  }
];

interface ClusterSelectorProps {
  selectedCluster: string;
  onClusterChange: (cluster: string) => void;
}

export const ClusterSelector = ({ selectedCluster, onClusterChange }: ClusterSelectorProps) => {
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
            <SelectItem key={cluster.name} value={cluster.name}>
              {cluster.name.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export { clusters };
