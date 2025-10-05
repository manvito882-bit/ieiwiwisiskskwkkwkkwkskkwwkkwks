import { TokenPurchase } from "@/components/TokenPurchase";
import { TokenBalance } from "@/components/TokenBalance";

const Tokens = () => {
  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Токены</h1>
        <TokenBalance />
      </div>
      
      <TokenPurchase />
    </div>
  );
};

export default Tokens;