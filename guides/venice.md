API Spec
​
Swagger Configuration
You can find the complete swagger definition for the Venice API here: https://api.venice.ai/doc/api/swagger.yaml

​
OpenAI Compatibility
Venice’s text inference API implements the OpenAI API specification, ensuring compatibility with existing OpenAI clients and tools. This document outlines how to integrate with Venice using this familiar interface.

​
Base Configuration
​
Required Base URL
All API requests must use Venice’s base URL:


Copy
const BASE_URL = "https://api.venice.ai/api/v1"
​
Client Setup
Configure your OpenAI client with Venice’s base URL:


Copy
import OpenAI from "openai";

new OpenAI({
  apiKey: "--Your API Key--",
  baseURL: "https://api.venice.ai/api/v1",
});
​
Available Endpoints
​
Models
Endpoint: /api/v1/models

Documentation: Models API Reference

Purpose: Retrieve available models and their capabilities

​
Chat Completions
Endpoint: /api/v1/chat/completions

Documentation: Chat Completions API Reference

Purpose: Generate text responses in a chat-like format

Example with `character_slug` parameter:

```javascript
const options = {
  method: 'POST',
  headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: "llama-3.3-70b",
    messages: [
      { role: "user", content: "Why is the sky blue?" }
    ],
    venice_parameters: {
      character_slug: "archon-01v"
    }
  })
};

fetch('https://api.venice.ai/api/v1/chat/completions', options)
  .then(response => response.json())
  .then(response => console.log(response))
  .catch(err => console.error(err));
```

System Prompts
Venice provides default system prompts designed to ensure uncensored and natural model responses. You have two options for handling system prompts:

Default Behavior: Your system prompts are appended to Venice’s defaults

Custom Behavior: Disable Venice’s system prompts entirely

​
Disabling Venice System Prompts
Use the venice_parameters option to remove Venice’s default system prompts:


Copy
const completionStream = await openAI.chat.completions.create({
  model: "default",
  messages: [
    {
      role: "system",
      content: "Your system prompt",
    },
    {
      role: "user",
      content: "Why is the sky blue?",
    },
  ],
  // @ts-expect-error Venice.ai paramters are unique to Venice.
  venice_parameters: {
    include_venice_system_prompt: false,
  },
});
​
Best Practices
Error Handling: Implement robust error handling for API responses

Rate Limiting: Be mindful of rate limits during the beta period

System Prompts: Test both with and without Venice’s system prompts to determine the best fit for your use case

API Keys: Keep your API keys secure and rotate them regularly

​
Differences from OpenAI’s API
While Venice maintains high compatibility with the OpenAI API specification, there are some Venice-specific features and parameters:

venice_parameters: Venice offers additional configurations not available via OpenAI

System Prompts: Different default behavior for system prompt handling

Model Names: Venice provides transformation for some common OpenAI model selection to comparable Venice support models, although it is recommended to review the models available on Venice directly (https://docs.venice.ai/api-reference/endpoint/models/list)

-----------------------------

Chat Completions
Run text inference based on the supplied parameters.


const options = {
  method: 'POST',
  headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
  body: '{"model":"llama-3.3-70b","messages":[{"role":"user","content":"<string>"}],"venice_parameters":{"enable_web_search":"auto","include_venice_system_prompt":true,"character_slug":"venice"},"frequency_penalty":0,"presence_penalty":0,"repetition_penalty":1.2,"n":1,"max_tokens":123,"max_temp":1.5,"min_temp":0.1,"max_completion_tokens":123,"temperature":0.7,"top_k":40,"top_p":0.9,"min_p":0.05,"stop":"<string>","stop_token_ids":[151643,151645],"stream":true,"stream_options":{"include_usage":true},"user":"<string>","parallel_tool_calls":false,"tools":[{"id":"<string>","type":"<string>","function":{"description":"<string>","name":"<string>","parameters":{}}}],"tool_choice":{"type":"<string>","function":{"name":"<string>"}},"response_format":{"type":"json_schema","json_schema":{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}}}'
};

fetch('https://api.venice.ai/api/v1/chat/completions', options)
  .then(response => response.json())
  .then(response => console.log(response))
  .catch(err => console.error(err));


  200
  {
  "id": "chatcmpl-a81fbc2d81a7a083bb83ccf9f44c6e5e",
  "object": "chat.completion",
  "created": 1739928524,
  "model": "qwen-2.5-vl",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "reasoning_content": null,
        "content": "The sky appears blue because of the way Earth's atmosphere scatters sunlight. When sunlight reaches Earth's atmosphere, it is made up of various colors of the spectrum, but blue light waves are shorter and scatter more easily when they hit the gases and particles in the atmosphere. This scattering occurs in all directions, but from our perspective on the ground, it appears as a blue hue that dominates the sky's color. This phenomenon is known as Rayleigh scattering. During sunrise and sunset, the sunlight has to travel further through the atmosphere, which allows more time for the blue light to scatter away from our direct line of sight, leaving the longer wavelengths, such as red, yellow, and orange, to dominate the sky's color.",
        "tool_calls": []
      },
      "logprobs": null,
      "finish_reason": "stop",
      "stop_reason": null
    }
  ],
  "usage": {
    "prompt_tokens": 612,
    "total_tokens": 758,
    "completion_tokens": 146,
    "prompt_tokens_details": null
  },
  "prompt_logprobs": null,
  "venice_parameters": {
    "web_search_citations": [],
    "include_venice_system_prompt": true
  }
}



400
{
  "error": "Invalid request parameters",
  "details": {
    "_errors": [],
    "field": {
      "_errors": [
        "Field is required"
      ]
    }
  }
}

401
{
  "error": "Authentication failed"
}

402
{
  "error": "Insufficient USD or VCU balance to complete request"
}

415
{
  "error": "Invalid request content-type"
}

429
{
  "error": "Rate limit exceeded"
}

500
{
  "error": "Inference processing failed"
}

503
{
  "error": "The model is at capacity. Please try again later."
}

Authorizations
​
Authorization
stringheaderrequired
Bearer authentication header of the form Bearer <token>, where <token> is your auth token.

Headers
​
Accept-Encoding
string
Supported compression encodings (gzip, br). Only applied when stream is false.

Example:
"gzip, br"

Body
application/json
​
model
stringrequired
The ID of the model you wish to prompt. May also be a model trait, or a compatibility mapping. See the models endpoint for a list of models available to you. You can use feature suffixes to enable features from the venice_parameters object. Please see "Model Feature Suffix" documentation for more details.

Example:
"llama-3.3-70b"

​
messages
object[]required
A list of messages comprising the conversation so far. Depending on the model you use, different message types (modalities) are supported, like text and images. For compatibility purposes, the schema supports submitting multiple image_url messages, however, only the last image_url message will be passed to and processed by the model.

User Message
Assistant Message
Tool Message
System Message
The user message is the input from the user. It is part of the conversation and is visible to the assistant.


Show child attributes

​
venice_parameters
object
Unique parameters to Venice's API implementation.


Show child attributes

​
frequency_penalty
numberdefault:0
Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

Required range: -2 <= x <= 2
​
presence_penalty
numberdefault:0
Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.

Required range: -2 <= x <= 2
​
repetition_penalty
number
The parameter for repetition penalty. 1.0 means no penalty. Values > 1.0 discourage repetition.

Required range: x >= 0
Example:
1.2

​
n
integerdefault:1
How many chat completion choices to generate for each input message. Note that you will be charged based on the number of generated tokens across all of the choices. Keep n as 1 to minimize costs.

​
max_tokens
integer
The maximum number of tokens that can be generated in the chat completion. This value can be used to control costs for text generated via API. This value is now deprecated in favor of max_completion_tokens.

​
max_temp
number
Maximum temperature value for dynamic temperature scaling.

Required range: 0 <= x <= 2
Example:
1.5

​
min_temp
number
Minimum temperature value for dynamic temperature scaling.

Required range: 0 <= x <= 2
Example:
0.1

​
max_completion_tokens
integer
An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.

​
temperature
numberdefault:0.8
What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both.

Required range: 0 <= x <= 2
Example:
0.7

​
top_k
integer
The number of highest probability vocabulary tokens to keep for top-k-filtering.

Required range: x >= 0
Example:
40

​
top_p
numberdefault:0.9
An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

Required range: 0 <= x <= 1
Example:
0.9

​
min_p
number
Sets a minimum probability threshold for token selection. Tokens with probabilities below this value are filtered out.

Required range: 0 <= x <= 1
Example:
0.05

​
stop

string | null
Up to 4 sequences where the API will stop generating further tokens. Defaults to null.

​
stop_token_ids
number[]
Array of token IDs where the API will stop generating further tokens.

Example:
[151643, 151645]
​
stream
boolean
Whether to stream back partial progress. Defaults to false.

Example:
true

​
stream_options
object

Show child attributes

​
user
string
This field is discarded on the request but is supported in the Venice API for compatibility with OpenAPI clients.

​
parallel_tool_calls
booleandefault:true
Whether to enable parallel function calling during tool use.

Example:
false

​
tools
object[] | null
A list of tools the model may call. Currently, only functions are supported as a tool. Use this to provide a list of functions the model may generate JSON inputs for.

A tool that can be called by the model. Currently, only functions are supported as tools.


Show child attributes

​
tool_choice

object

Show child attributes

​
response_format
object
Format in which the response should be returned. Currently supports JSON Schema formatting.


Show child attributes

Response
200

200
application/json
OK
​
id
stringrequired
The ID of the request.

Example:
"chatcmpl-abc123"

​
object
enum<string>required
The type of the object returned.

Available options: chat.completion 
Example:
"chat.completion"

​
created
integerrequired
The time at which the request was created.

Example:
1677858240

​
model
stringrequired
The model id used for the request.

Example:
"llama-3.3-70b"

​
choices
object[]required
A list of chat completion choices. Can be more than one if n is greater than 1.


Show child attributes

Example:
[
  {
    "index": 0,
    "message": {
      "role": "assistant",
      "reasoning_content": null,
      "content": "The sky appears blue because of the way Earth's atmosphere scatters sunlight. When sunlight reaches Earth's atmosphere, it is made up of various colors of the spectrum, but blue light waves are shorter and scatter more easily when they hit the gases and particles in the atmosphere. This scattering occurs in all directions, but from our perspective on the ground, it appears as a blue hue that dominates the sky's color. This phenomenon is known as Rayleigh scattering. During sunrise and sunset, the sunlight has to travel further through the atmosphere, which allows more time for the blue light to scatter away from our direct line of sight, leaving the longer wavelengths, such as red, yellow, and orange, to dominate the sky's color.",
      "tool_calls": []
    },
    "logprobs": null,
    "finish_reason": "stop",
    "stop_reason": null
  }
]
​
usage
objectrequired

Show child attributes

​
venice_parameters
objectrequired

Show child attributes

​
prompt_logprobs

null · any | null
Log probability information for the prompt.