//environments/environment.ts
// export const environment = {
//   production: false,
//   wsBaseUrl: 'ws://localhost:8000', // o 'wss://tu-dominio' en producción
//   baseUrl:'http://localhost:8000',
//   generatorUrl:'http://localhost:8080'
// };

export const environment = {
  production: false,
  wsBaseUrl: 'ws://ec2-54-221-79-109.compute-1.amazonaws.com:8000',
  baseUrl:'http://ec2-54-221-79-109.compute-1.amazonaws.com:8000',
  generatorUrl:'http://ec2-54-221-79-109.compute-1.amazonaws.com:8080'
};
