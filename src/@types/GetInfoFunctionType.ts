type GetInfoFunctionType = () => {
  name: string
  imageUrl?: string
  description: string
  url: string
  disabled?: boolean,
  domains: string[],
};

export default GetInfoFunctionType;
