//environments/environment.ts
// export const environment = {
//   production: false,
//   wsBaseUrl: 'ws://localhost:8000', // o 'wss://tu-dominio' en producción
//   baseUrl:'http://localhost:8000',
//   generatorUrl:'http://localhost:8080'
// };

export const environment = {
  production: true,
  wsBaseUrl: 'ws://ec2-18-215-174-58.compute-1.amazonaws.com:8000',
  baseUrl:'http://ec2-18-215-174-58.compute-1.amazonaws.com:8000',
  generatorUrl:'http://ec2-18-215-174-58.compute-1.amazonaws.com:8080'
};
