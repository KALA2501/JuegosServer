
# Use an official Node.js runtime as a parent image
FROM node:16-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies (if you have it)
COPY package*.json ./
RUN npm install

# Copy the rest of the project files into the container
COPY . .

# Expose port 9094 to allow communication
EXPOSE 9094

# Start the Node.js server
CMD ["node", "server.js"]
