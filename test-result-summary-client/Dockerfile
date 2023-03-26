FROM node:16

WORKDIR /usr/src/app

COPY . . 

RUN sed -i 's/localhost/service/g' package.json

RUN npm ci 

EXPOSE 3000
CMD npm start
