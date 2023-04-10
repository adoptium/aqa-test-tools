FROM node:18

WORKDIR /usr/src/app

# Install serve first as it has no dependencies.
RUN npm install -g serve

# Only copy the npm related dependencies as they change rarely.
COPY package.json package-lock.json . 
RUN sed -i 's/localhost/service/g' package.json
RUN npm ci --legacy-peer-deps

# Copy the rest of the app and build it.
COPY . .
ARG REACT_APP_CONNECT_ADOPTIUM_API
ENV REACT_APP_CONNECT_ADOPTIUM_API=$REACT_APP_CONNECT_ADOPTIUM_API
RUN npm run build

WORKDIR /usr/src/app/build
EXPOSE 3000
ENTRYPOINT ["serve", "--single"]