# APIMyLlama V2 Documentation

## Overview

[![APIMyLlama Video](https://img.youtube.com/vi/x_MSmGX3Vmc/hqdefault.jpg)](https://www.youtube.com/embed/x_MSmGX3Vmc)

APIMyLlama is a server application that provides an interface to interact with the Ollama API, a powerful AI tool to run LLMs. It allows users to run this alongside Ollama to easily distrubute API keys to create amazing things.

### Support Us

We now have a [Ko-fi](https://ko-fi.com/gimerstudios) open if you would like to help and donate to the project. We love to keep it free and open source when possible and donating helps a lot.

[Donate through Ko-fi](https://ko-fi.com/gimerstudios)

# Installation

## Ollama Setup
If you already have Ollama setup with the 'ollama serve' command and your desired model. You can skip this. If not i'll show you how to set it up. First install [Ollama](https://ollama.com/download) for your desired operating system. Once installed open a terminal instance and run the command below.
```bash
ollama pull llama3
```

If done correctly you should now have the Meta's Llama3 LLM installed. You can use any model with the API but for this example we will use this model. Now you are gonna run this command after the install is complete.
```bash
ollama serve
```
Now you have an Ollama server setup. Time for the next step.

## Hosting the API


Install [Node.JS](https://nodejs.org/en/download/package-manager) on your server. Then clone the git repository.

```bash
git clone https://github.com/Gimer-Studios/APIMyLlama.git
cd APIMyLlama
npm install
node APIMyLlama.js
```
After cloning go into the cloned directory and installing all the needed dependencies by running the 'npm install' command. Then run the APIMyLlama.js file.
On startup it will ask what port you want to use.
```
PS C:\Users\EXAMPLE\Documents\APIMyLlama> node APIMyLlama.js
Connected to the apiKeys.db database.
Enter the port number: <ENTER_PORT>
Enter the port number for the Ollama server (Port that your Ollama server is running on. By default it is 11434 so if you didnt change anything it should be that.): <PORT_FOR_OLLAMA_SERVER
```
Enter the desired port you would like to use with the API. This port can NOT be the same as Ollama or any other application running on your server. After you choose your port you will NEED to port foward this port if you are gonna use the API Key system OUTSIDE of your network. Then it will ask you to enter the port for your Ollama server. This is the port Ollama is running on. By default Ollama uses port 11434.

## Commands
These are the commands you can use in the APIMyLlama application

```bash
generatekey
```
This command will generate a key using Cryptography and save it to the local database.

```bash
listkey
```
This command will list all API Keys in the database.

```bash
removekey <API_KEY>
```
This command will remove any key from the database.

```bash
addkey <API_KEY>
```
You can add custom keys if wanted. (DO with CAUTION as it may be unsafe)

```bash
changeport <SERVER_PORT>
```
You can change the servers port in realtime without having to restart the application.

```bash
changeollamaport <YOUR_OLLAMA_SERVER_PORT>
```
You can change the Ollama Server port if you have a custom one set. By default it is 11434.

```bash
addwebhook <YOUR_WEBHOOK>
```
You can add webhooks for alerts when a new request is made. EX. Discord Webhook

```bash
listwebhooks
```
This command will list all the webhooks you have attached to your system.

```bash
deletewebhook <ID_OF_WEBHOOK_IN_DATABASE>
```
This command can be used to remove a webhook in your system. You can get the ID of the webhook using the 'listwebhooks' command.

```bash
ratelimit <API_KEY> <RATE_LIMIT>
```
This command allows you to change the ratelimit on a key. By default it is 10. The rate limit is by minute. So for example the default allows 10 requests to the API per minute.

```bash
deactivatekey <API_KEY>
```
Allows you to deactivate an API key. This will make the key useless untill it is activated.

```bash
activatekey <API_KEY>
```
Activates a API key that has been deactivated in the past.

```bash
addkeydescription <API_KEY>
```
This command lets you add a description to a key to help you decipher what key does what.

```bash
listkeydescription <API_KEY>
```
This command lists the description of that key if it has a description.

```bash
generatekeys <number>
```
Quickly generate multiple new API keys.

```bash
regeneratekey <API_KEY>
```
Regenerate any specified API key without affecting other details.

```bash
activateallkeys
```
Activate all your API keys with a single command.

```bash
deactivateallkeys
```
Deactivate all your API keys with a single command.

```bash
getkeyinfo <API_KEY>
```
Retrieve detailed information about a specific API key.

```bash
listactivekeys
```
Easily list all active API keys.

```bash
listinactivekeys
```
Easily list all inactive API keys.

## Working with the API
Install APIMyLlama packages with NPM (Node.JS), PIP (Python), Jitpack Repo+Gradle or Maven (Java), or from the Crates Repository (Rust)

NPM Install (Node.JS)
```bash
  cd PROJECT_NAME
  npm install apimyllama-node-package
```
PIP Install (Python)
```bash
  cd PROJECT_NAME
  pip install apimyllama
```
Jitpack+Gradle Repository <build.gradle> (Java IF YOUR USING GRADLE)
```bash
	dependencyResolutionManagement {
		repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
		repositories {
			mavenCentral()
			maven { url 'https://www.jitpack.io' }
		}
	}
```

Jitpack+Gradle Dependency <build.gradle> (Java IF YOUR USING GRADLE)
```bash
	dependencies {
	        implementation 'com.github.Gimer-Studios:APIMyLlama-Java-Package:V2.0.5'
	}
```

Jitpack+Maven Repository <pom.xml> (Java IF YOUR USING MAVEN)
```bash
	<repositories>
		<repository>
		    <id>jitpack.io</id>
		    <url>https://www.jitpack.io</url>
		</repository>
	</repositories>
```

Jitpack+Maven Dependency <pom.xml> (Java IF YOUR USING MAVEN)
```bash
	<dependency>
	    <groupId>com.github.Gimer-Studios</groupId>
	    <artifactId>APIMyLlama-Java-Package</artifactId>
	    <version>V2.0.5</version>
	</dependency>
```
Crate Repository <Cargo.toml> (Rust)
```bash
    [dependencies]
    apimyllama = "2.0.7"
    tokio = { version = "1", features = ["full"] }
```

# Examples to get response from API

Node.JS example:
```bash
const apiMyLlamaNodePackage = require('apimyllama-node-package');

// Intialize Parameters
const apikey = 'API_KEY';
const prompt = 'Hello!';
const model = 'llama3';
const ip = 'SERVER_IP';
const port = 'SERVER_PORT';
const stream = false;

apiMyLlamaNodePackage.generate(apikey, prompt, model, ip, port, stream)
  .then(response => console.log(response))
  .catch(error => console.error(error));
  ```

Python example:
```bash
import requests
from apimyllama import ApiMyLlama

def main():
    ip = "SERVER_IP"
    port = "PORT_NUMBER"
    apikey = "API_KEY" 
    prompt = "Hello"
    model = "llama3" 
    api = ApiMyLlama(ip, port)
    try:
        result = api.generate(apikey, prompt, model)
        print("API Response:", result)
    except requests.RequestException as e:
        print("An error occurred:", e)

if __name__ == "__main__":
    main()
```

Java Example:
```bash
import com.gimerstudios.apimyllama.ApiMyLlama;
import java.io.IOException;

public class TestAPIMyLlama {

    public static void main(String[] args) {
        String serverIp = "SERVER_IP";
        int serverPort = SERVER_PORT;
        String apiKey = "API_KEY";
        String prompt = "Hello!";
        String model = "llama3";
        boolean stream = false;

        ApiMyLlama apiMyLlama = new ApiMyLlama(serverIp, serverPort);

        try {
            String response = apiMyLlama.generate(apiKey, prompt, model, stream);
            System.out.println("Generate Response: " + response);
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

Rust Example:
```bash
use apimyllama::ApiMyLlama;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let server_ip = "127.0.0.1".to_string();
    let server_port = 3000;  
    let api_key = "api";
    let api = ApiMyLlama::new(server_ip, server_port);
    let prompt = "Hello!";
    let model = "llama3";

    match api.generate(api_key, prompt, model, false).await {
        Ok(response) => {
            println!("Response: {}", response.response);
            println!("Model: {}", response.model);
            println!("Created At: {}", response.created_at);
            println!("Done: {}", response.done);
            println!("Done Reason: {}", response.done_reason);
            println!("Context: {:?}", response.context);
            println!("Total Duration: {}", response.total_duration);
            println!("Load Duration: {}", response.load_duration);
            println!("Prompt Eval Duration: {}", response.prompt_eval_duration);
            println!("Eval Count: {}", response.eval_count);
            println!("Eval Duration: {}", response.eval_duration);
        }
        Err(e) => println!("Text generation failed: {}", e),
    }

    Ok(())
}
```

## Checking API Health
The packages have built in health checking command (AS OF V2)
If you already have the Node.js or Python packages installed then you can just copy and paste the code below to test.

Node.JS example:
```bash
const apiMyLlamaNodePackage = require('apimyllama-node-package');

// Intialize Parameters
const apikey = 'API_KEY';
const ip = 'SERVER_IP';
const port = 'SERVER_PORT';


apiMyLlamaNodePackage.getHealth(apikey, ip, port)
  .then(response => console.log('Health Check Response:', response))
  .catch(error => console.error('Error:', error));
  ```

  Python example:
```bash
import requests
from apimyllama import ApiMyLlama

ip = 'YOUR_SERVER_IP'
port = 'YOUR_SERVER_PORT'
apikey = 'YOUR_API_KEY'

api = ApiMyLlama(ip, port)

try:
    health = api.get_health(apikey)
    print("Health Check Response:", health)
except requests.RequestException as error:
    print("Error:", error)
```

  Java example:
```bash
import com.gimerstudios.apimyllama.ApiMyLlama;
import java.io.IOException;
import java.util.Map;

public class TestAPIMyLlama {

    public static void main(String[] args) {
        String serverIp = "SERVER_IP";
        int serverPort = SERVER_PORT;
        String apiKey = "API_KEY";

        ApiMyLlama apiMyLlama = new ApiMyLlama(serverIp, serverPort);

        try {
            Map<String, Object> healthStatus = apiMyLlama.getHealth(apiKey);
            System.out.println("Health Status: " + healthStatus);
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

Rust Example:
```bash
use apimyllama::ApiMyLlama;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let server_ip = "127.0.0.1".to_string();
    let server_port = 3000;  
    let api_key = "api";
    let api = ApiMyLlama::new(server_ip, server_port);

    match api.get_health(api_key).await {
        Ok(response) => {
            println!("API Health Status: {}", response.status);
            println!("Timestamp: {}", response.timestamp);
        }
        Err(e) => println!("Health check failed: {}", e),
    }

    Ok(())
}
```

## API References
```
ApiMyLlama(ip, port)
ip: IP address of the APIMyLlama server.
port: Port number on which the APIMyLlama server is running.
```
```
api.generate(apiKey, prompt, model, stream)
api.get_health(apikey)
apiKey: API key for accessing the Ollama API.
prompt: Text prompt to generate a response.
model: Machine learning model to use for text generation.
stream: Boolean indicating whether to stream the response.
```
# Support
If there are any issues please make a Github Issue Report. To get quicker support join our discord server.
-[Discord Server](https://discord.gg/r6XazGtKg7) If there are any feature requests you may request them in the discord server. PLEASE NOTE this project is still in EARLY BETA. 

### Support Us

We now have a [Ko-fi](https://ko-fi.com/gimerstudios) open if you would like to help and donate to the project. We love to keep it free and open source when possible and donating helps a lot.

[Donate through Ko-fi](https://ko-fi.com/gimerstudios)


## FAQ

#### 1. Why am I getting the module not found error?

You most likely forgot to run the 'npm install' command after cloning the repository.

#### 2. Why can't I use the API outside my network?

You probably didn't port foward. And if you did your router may have not intialized the changes yet or applied them.

#### 3. Ollama Serve command error "Error: listen tcp 127.0.0.1:11434: bind: Only one usage of each socket address (protocol/network address/port) is normally permitted."

If you get this error just close the Ollama app through the system tray on Windows. And if your on Linux just use systemctl to stop the Ollama process. Once done you can try running the ollama serve command again.

#### 4. error: 'Error making request to Ollama API'

If you have a custom port set for your Ollama server this is a simple fix. Just run the 'changeollamaport <YOUR_OLLAMA_SERVER_PORT>' and change it to the port your Ollama server is running on. By default it is 11434 but if you changed it you will need to do this. You can also fix this problem through changing the port in the ollamaPort.conf file.

## Authors

- [@gimerstudios](https://github.com/Gimer-Studios)
