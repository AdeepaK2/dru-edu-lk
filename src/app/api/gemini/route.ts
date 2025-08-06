import { NextRequest, NextResponse } from 'next/server';

// Define course information that the AI will use to answer questions
const COURSE_DATA = `
Dr. U Education Courses and Information:

VCE Mathematics:
- Math Methods - [VCE 2024]: SUNDAY 7:45PM – 11:45PM, GLEN WAVERLEY
- Specialist Math - [VCE 2024]: Friday 8:00PM – 11:30PM, GLEN WAVERLEY
- Math Methods – [VCE 2025]: SUNDAY 6:15pm - 7:45pm, GLEN WAVERLEY
- Math Methods - [VCE 2024]: Sunday 7:00am – 11:00aM, DR. U EDUCATION CENTRE - Cranbourne
- Specialist Math – [VCE 2024]: Saturday 7:00am - 11:00am, DR. U EDUCATION CENTRE - Cranbourne
- Specialist Math – [VCE 2025]: SATURDAY 2:00PM – 4:00PM, DR. U EDUCATION CENTRE - Cranbourne
- Math Methods – [VCE 2025]: Monday 7:30PM – 9:30PM, DR. U EDUCATION CENTRE - Cranbourne
- Math Methods – [VCE 2025]: Monday 7:30PM – 9:30PM, Niddrie (northern Suburbs)

VCE Sciences:
- Physics - [VCE 2024]: THURDAY 8:30pm - 10:30pm, GLEN WAVERLEY
- Chemistry - [VCE 2025]: SATURDAY 4:45PM – 6:15PM, GLEN WAVERLEY
- Physics - [VCE 2025]: Thursday 5:00PM – 6:30PM, DR. U EDUCATION CENTRE - Cranbourne
- Chemistry - [VCE 2024]: sunday 2:00PM – 4:00PM, DR. U EDUCATION CENTRE - CRANBOURNE
- Physics - [VCE 2024]: Saturday 11:00AM-12:30PM, DR. U EDUCATION CENTRE - CRANBOURNE
- Chemistry - [VCE 2025]: SATURDAY 12:30PM – 2:00PM, DR. U EDUCATION CENTRE - CRANBOURNE

Selective School Coaching:
- SELECTIVE SCHOOL PREPARATION 2023 [GRADE 8]: MONDAY 6:00PM – 8:00PM, DR. U EDUCATION CENTRE - Cranbourne
- SELECTIVE SCHOOL PREPARATION 2024 [GRADE 7]: SUNDAY 11.30AM-1.00PM, DR. U EDUCATION CENTRE - CRANBOURNE

Foundation Mathematics (Years 5-9):
- Y 9 Math - [Accelerated]: Friday 4:45pm - 6:30Pm, GLEN WAVERLEY
- Y 7 Math – [Accelerated]: Tuesday 5:30PM – 7:00PM, Glen Waverly
- Y 6 Math - [Accelerated]: TUESDAY 7:00PM – 8:30PM, GLEN WAVERLEY

Business & Economics & Accounting:
- Accounting - [VCE 2025]: Monday 5:30pm - 7:00Pm, GLEN WAVERLEY
- Business Managment – [VCE 2025]: Tuesday 5:30PM – 7:00PM, Glen Waverly
- Economics - [VCE 2025]: monDAY 7:00PM – 8:30PM, GLEN WAVERLEY

English:
- Y 6 - [ENGLISH]: Monday 5:30pm - 7:00Pm, DR. U EDUCATION CENTRE - Cranbourne
- Y 7 - [ENGLISH]: FRIDAY 5:30PM – 7:00PM, DR. U EDUCATION CENTRE - Cranbourne
- Y 5 - [ENGLISH]: SATURDAY 9:00AM – 10:00PM, NIDDRIE (NORTHERN SUBURBS)
- Y 7 - [ENGLISH]: tHURSDAY 6:30Pm – 8:00Pm, gLEN WAVERLY

Locations:
- DR. U EDUCATION CENTRE - Cranbourne: 63A High Street Cranbourne
- GLEN WAVERLEY: 230/A Blackburn Road, Glen Waverley
- City: Melbourne, Victoria, Australia

Contact:
- Email: info@drueducation.com
- Phone: 0478 716 402

About Dr. U Education:
Dr. U Education is Melbourne's premier education center specializing in VCE Mathematics, Sciences, and selective school preparation. Our institute is known for its personalized coaching approach, expert guidance, and innovative teaching methods that have helped thousands of students achieve outstanding results in their academic journey.

Dr. U Education provides comprehensive coaching with a proven track record of student success. Our VCE students consistently achieve high study scores, with many scoring above 45 in challenging subjects like Specialist Mathematics, Mathematical Methods, Physics, and Chemistry.

Our classes are kept small to ensure personalized attention, and our teaching methodology focuses on building strong foundations, problem-solving skills, and exam preparation techniques.
`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }
    
    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1]?.content || '';
    
    // Create context for the AI with course information and the conversation history
    const systemContext = `You are an assistant for Dr. U Education, a premier educational institute in Melbourne, Australia. 
    Use the following information about courses, locations, and institute details to answer questions:
    ${COURSE_DATA}
    
    Always be polite, helpful, and concise in your responses. If someone asks about course details, provide specific information from the course data.
    If you don't know the answer or if someone asks about something not in the data, suggest they contact the institute directly using the contact information provided.
    Do not make up information that is not provided in the context. Focus primarily on information related to courses, scheduling, locations, and general institute information.`;
    
    // For Gemini, we need to structure our system context differently
    // We'll prepend it to the first message rather than using a system role
    
    // Check if this is a new conversation (only one message which is the current user message)
    const isNewConversation = messages.length <= 1;
    
    // Build the Gemini API request payload
    // For simplicity, we'll include all context in a single prompt
    let fullPrompt = `You are an assistant for Dr. U Education, a premier educational institute in Melbourne, Australia. 
Use the following information about courses, locations, and institute details to answer questions:
${COURSE_DATA}

Always be polite, helpful, and concise in your responses. If someone asks about course details, provide specific information from the course data.
If you don't know the answer or if someone asks about something not in the data, suggest they contact the institute directly using the contact information provided.
Do not make up information that is not provided in the context. Focus primarily on information related to courses, scheduling, locations, and general institute information.

`;

    // Add conversation history if there are previous messages
    if (messages.length > 1) {
      fullPrompt += "Previous conversation:\n";
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      }
      fullPrompt += "\n";
    }
    
    fullPrompt += `Current question: ${latestUserMessage}`;

    const geminiPayload = {
      contents: [
        {
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };
    
    // Send request to Gemini API
    const geminiApiKey = process.env.GEMINI_KEY;
    if (!geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(geminiPayload)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the assistant's response
    const assistantResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process your request at this time.";
    
    return NextResponse.json({ 
      response: assistantResponse 
    });
    
  } catch (error) {
    console.error("Error processing chat request:", error);
    return NextResponse.json(
      { 
        error: "Failed to process your request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}