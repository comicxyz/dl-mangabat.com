import GetInfoFunctionType from '../../@types/GetInfoFunctionType.js';

const getInfo: GetInfoFunctionType = () => ({
  name: 'Website Name',
  url: 'https://website.example',
  imageUrl: 'image.jpg',
  description: '',
  disabled: false,
  domains: ['www.website.example'],
});

export default getInfo;
